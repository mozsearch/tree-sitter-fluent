"""Compare tree-sitter-fluent's parses of the Fluent spec fixtures with their
reference ASTs: each message's/term's id, value presence, attributes, and
references (messages, terms, variables, functions, named arguments), and the
comment kinds.  Usage: scripts/spec-conformance.py . FLUENT_REPO/test/fixtures (with
https://github.com/projectfluent/fluent checked out at FLUENT_REPO)."""
import collections, json, os, re, subprocess, sys
import xml.etree.ElementTree as ET

grammar, fixtures = sys.argv[1], sys.argv[2]

def ts_parse(path):
    out = subprocess.run(["npx", "-y", "tree-sitter-cli@0.25.4", "parse", "--xml", path],
                         cwd=grammar, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.decode()
    # (Control characters aren't allowed in XML.)
    out = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "?", out)
    start = out.find("<?xml")
    end = out.rfind("</resource>")
    return ET.fromstring(out[start:end + len("</resource>")]) if start >= 0 and end >= 0 else None

def field(el, name):
    return next((c for c in el if c.get("field") == name), None)

def ftext(el, name):
    f = field(el, name)
    return f.text if f is not None and f.text else "?"

def xml_refs(el):
    refs = []
    for d in el.iter():
        if d.tag == "message_reference":
            a = field(d, "attribute")
            refs.append("msg:" + ftext(d, "id") + ("." + (a.text or "?") if a is not None else ""))
        elif d.tag == "term_reference":
            a = field(d, "attribute")
            refs.append("term:" + ftext(d, "id").lstrip("-") + ("." + (a.text or "?") if a is not None else ""))
        elif d.tag == "variable_reference":
            refs.append("var:" + ftext(d, "id"))
        elif d.tag == "function_reference":
            refs.append("fn:" + ftext(d, "id"))
        elif d.tag == "named_argument":
            refs.append("named:" + ftext(d, "name"))
    return sorted(refs)

def xml_summary(root):
    entries, comments, errors = [], collections.Counter(), 0
    for el in root:
        if el.tag in ("message", "term"):
            attrs = tuple(ftext(a, "id") for a in el if a.tag == "attribute")
            entries.append((el.tag, ftext(el, "id").lstrip("-"), field(el, "value") is not None, attrs, tuple(xml_refs(el))))
        elif el.tag in ("comment", "group_comment", "resource_comment"):
            comments[el.tag] += 1
        elif el.tag == "ERROR":
            errors += 1
    errors += sum(1 for d in root.iter() if d.tag in ("ERROR", "MISSING"))
    return entries, comments, errors

def json_refs(node, refs):
    if isinstance(node, dict):
        t = node.get("type")
        if t == "MessageReference":
            refs.append("msg:" + node["id"]["name"] + ("." + node["attribute"]["name"] if node.get("attribute") else ""))
        elif t == "TermReference":
            refs.append("term:" + node["id"]["name"] + ("." + node["attribute"]["name"] if node.get("attribute") else ""))
        elif t == "VariableReference":
            refs.append("var:" + node["id"]["name"])
        elif t == "FunctionReference":
            refs.append("fn:" + node["id"]["name"])
        elif t == "NamedArgument":
            refs.append("named:" + node["name"]["name"])
        for k, v in node.items():
            if k not in ("id", "name"):
                json_refs(v, refs)
    elif isinstance(node, list):
        for v in node:
            json_refs(v, refs)
    return refs

def json_summary(ast):
    entries, comments, junk = [], collections.Counter(), 0
    kinds = {"Comment": "comment", "GroupComment": "group_comment", "ResourceComment": "resource_comment"}
    for e in ast["body"]:
        t = e["type"]
        if t in ("Message", "Term"):
            attrs = tuple(a["id"]["name"] for a in e.get("attributes", []))
            refs = sorted(json_refs(e.get("value"), []) + json_refs(e.get("attributes", []), []))
            entries.append((t.lower(), e["id"]["name"], e.get("value") is not None, attrs, tuple(refs)))
            if e.get("comment"):
                comments["comment"] += 1
        elif t in kinds:
            comments[kinds[t]] += 1
        elif t == "Junk":
            junk += 1
    return entries, comments, junk

ok = 0
for name in sorted(os.listdir(fixtures)):
    if not name.endswith(".ftl"):
        continue
    base = name[:-4]
    ast = json.load(open(os.path.join(fixtures, base + ".json")))
    root = ts_parse(os.path.join(fixtures, name))
    if root is None:
        print(f"{base}: no parse")
        continue
    xe, xc, xerr = xml_summary(root)
    je, jc, jjunk = json_summary(ast)
    # The reference's entries in order within ours; ours may have more where it has junk.
    missing = []
    i = 0
    for e in je:
        while i < len(xe) and xe[i] != e:
            i += 1
        if i == len(xe):
            missing.append(e)
        else:
            i += 1
    extra = len(xe) - (len(je) - len(missing))
    problems = []
    if missing:
        problems.append(f"{len(missing)} missing, ex: {missing[0]}")
    if extra and not jjunk:
        problems.append(f"{extra} extra entries but no junk")
    if xerr and not jjunk:
        problems.append(f"{xerr} errors but no junk")
    if xc != jc and not jjunk:
        problems.append(f"comments {dict(xc)} vs {dict(jc)}")
    status = "ok" if not problems else "DIFF"
    ok += not problems
    print(f"{base}: {status} (entries {len(je)}/{len(xe)}, junk {jjunk}, errors {xerr}) {'; '.join(problems)}")
print(f"{ok} fixtures ok")
