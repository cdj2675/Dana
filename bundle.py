# claude.ai 아티팩트 게시용: index.html에 design-*.js를 넣어 파일 하나로 만듭니다.
# 사용: python3 bundle.py  →  dist/dana.html
import pathlib, re
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
def inline(m):
    js = (root / m.group(1)).read_text(encoding='utf-8')
    assert '</script' not in js.lower(), m.group(1) + ' 안에 </script 가 있습니다'
    return '<script>\n' + js + '\n</script>'
out = re.sub(r'<script src="(design-[a-z]+\.js)"></script>', inline, html)
assert 'src="design-' not in out
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'dana.html').write_text(out, encoding='utf-8')
print('dist/dana.html', len(out.encode('utf-8')) // 1024, 'KB')
