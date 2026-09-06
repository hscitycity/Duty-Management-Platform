# -*- coding: utf-8 -*-
"""hwpx → md 변환기 (당직매뉴얼 전용)

    python scripts/hwpx2md.py "2026 화성시 당직메뉴얼.hwpx" data/manual_2026.md

hwpx 는 XML 묶음(zip)이다. 문단(hp:p)과 표(hp:tbl)를 문서 순서대로 훑어
사람이 읽는 마크다운으로 옮긴다. 표는 그대로 표로 남긴다 —
당직 매뉴얼의 알맹이(용역업체 연락처·처리 절차)가 대부분 표 안에 있기 때문이다.

원본은 지운 적이 없다. 이 파일은 원본을 바꾸지 않는다.
"""
import sys, re, zipfile
import xml.etree.ElementTree as ET

NS = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
}
P   = '{%s}p'   % NS['hp']
T   = '{%s}t'   % NS['hp']
TBL  = '{%s}tbl'      % NS['hp']
TR   = '{%s}tr'       % NS['hp']
TC   = '{%s}tc'       % NS['hp']
ADDR = '{%s}cellAddr' % NS['hp']
SPAN = '{%s}cellSpan' % NS['hp']

def para_text(el):
    """문단 하나의 글자만 모은다(표 안 글자는 표에서 따로 다룬다)."""
    out = []
    for t in el.iter(T):
        if t.text:
            out.append(t.text)
    return re.sub(r'[ \t ]+', ' ', ''.join(out)).strip()

def cell_text(tc):
    """표 한 칸 — 여러 문단이면 <br> 로 잇는다."""
    lines = []
    for p in tc.iter(P):
        s = para_text(p)
        if s:
            lines.append(s)
    return '<br>'.join(lines).replace('|', '\\|')

def table_md(tbl):
    """칸 주소(cellAddr)를 그대로 써서 자리를 맞춘다.
       병합된 칸을 순서대로만 늘어놓으면 열이 밀려 다른 줄의 값처럼 읽힌다."""
    grid = {}
    for tr in tbl.findall('.//' + TR):
        for tc in tr.findall(TC):
            a = tc.find(ADDR)
            sp = tc.find(SPAN)
            r = int(a.get('rowAddr', 0)) if a is not None else 0
            c = int(a.get('colAddr', 0)) if a is not None else 0
            cs = int(sp.get('colSpan', 1)) if sp is not None else 1
            grid[(r, c)] = (cell_text(tc), cs)
    if not grid:
        return []
    nr = max(k[0] for k in grid) + 1
    nc = max(k[1] + grid[k][1] for k in grid)
    rows = []
    for r in range(nr):
        line = [''] * nc
        for c in range(nc):
            v = grid.get((r, c))
            if v:
                line[c] = v[0]
        if any(line):
            rows.append(line)
    if not rows:
        return []
    w = nc
    out = ['| ' + ' | '.join(rows[0]) + ' |',
           '|' + '|'.join([' --- '] * w) + '|']
    for r in rows[1:]:
        out.append('| ' + ' | '.join(r) + ' |')
    return out

def heading(s):
    """번호 매김을 보고 제목 층을 정한다. 한글 문서의 관례를 그대로 읽는다."""
    if re.match(r'^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\s*[.·]', s):        return 2
    if re.match(r'^[□■]\s*', s):                            return 3
    if re.match(r'^[○●]\s*', s):                            None
    if re.match(r'^\d{1,2}\s*[.]\s*\S', s) and len(s) < 60:  return 3
    if re.match(r'^제\s*\d+\s*(장|절)', s):                  return 2
    if re.match(r'^[<〈][^>〉]{2,40}[>〉]$', s):              return 3
    return 0

def convert(src, dst):
    z = zipfile.ZipFile(src)
    secs = sorted([n for n in z.namelist()
                   if re.match(r'Contents/section\d+\.xml$', n)],
                  key=lambda n: int(re.search(r'(\d+)', n).group(1)))
    out = []
    for name in secs:
        root = ET.fromstring(z.read(name))
        # 표를 먼저 훑어 둔다 — 표를 품은 문단이 표보다 먼저 나오기 때문이다.
        # 미리 알아 두지 않으면 표 안 글자가 한 줄로 눌린 채 한 번 더 나온다.
        seen_tbl, done_tbl, in_tbl = set(), set(), set()
        for t in root.iter(TBL):
            seen_tbl.add(id(t))
            for q in t.iter(P):
                in_tbl.add(id(q))
        for el in root.iter():
            if el.tag == TBL:
                if id(el) in done_tbl:
                    continue
                done_tbl.add(id(el))
                for sub in el.iter(TBL):
                    done_tbl.add(id(sub))
                md = table_md(el)
                if md:
                    out.append('')
                    out.extend(md)
                    out.append('')
            elif el.tag == P:
                # 표 안 문단은 표에서 이미 다뤘다 — 두 번 적으면 표가 글줄로 한 번 더 눌려 나온다
                if id(el) in in_tbl:
                    continue
                if any(id(a) in seen_tbl for a in el.iter(TBL)):
                    continue
                s = para_text(el)
                if not s:
                    continue
                h = heading(s)
                out.append(('#' * h + ' ' + s) if h else s)
    # 빈 줄이 세 줄 이상 이어지지 않게
    txt = '\n'.join(out)
    txt = re.sub(r'\n{3,}', '\n\n', txt).strip() + '\n'
    with open(dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write(txt)
    return txt

if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else '2026 화성시 당직메뉴얼.hwpx'
    dst = sys.argv[2] if len(sys.argv) > 2 else 'data/manual_2026.md'
    t = convert(src, dst)
    print('%s → %s  (%d자 · %d줄)' % (src, dst, len(t), t.count('\n')))
