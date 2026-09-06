# -*- coding: utf-8 -*-
"""당직매뉴얼 md → 화면이 쓰는 두 파일

    python scripts/md2manual.py data/manual_2026.md

  data/manual.json      매뉴얼 전문 검색(대응매뉴얼)이 읽는다.
                        {t: 제목, d: 소관부서, tel: 내선, b: 검색용 본문, md: 표까지 살린 원문}
  data/manual_dept.json AI 담당부서 지정이 근거로 삼는다.
                        {sec, dept, team, tel, vendor, kw[]}

왜 나누는가
  화면은 '보기 좋게'가 목적이고, 배정은 '어디 소관인가'가 목적이다.
  같은 원문에서 나오지만 쓰는 모양이 다르다. 원문(md)은 하나로 둔다.
"""
import sys, re, json, io

# 매뉴얼의 장 머리는 대개 표 한 칸에 들어 있다 —
#   | 찻길 동물 사체 수거 민원 처리 매뉴얼<br>(자원순환과 자원화시설팀 ☎2559) |
HEAD = re.compile(r'^\|\s*([^|<]{4,60}?)\s*(?:<br>)?\s*(?:\(([^)]{2,40})\))?\s*\|\s*$')
DEPT = re.compile(r'([가-힣]{2,12}(?:과|관|단|소|실|센터|팀))\s*([가-힣]{2,12}팀)?\s*[☎☏]?\s*([0-9][0-9\-]{2,13})?')
TEL  = re.compile(r'(?:☎|☏)\s*([0-9][0-9\-~]{2,15})|((?:031-)?[0-9]{3,4}-[0-9]{4})')

STOP = set('민원 처리 요령 매뉴얼 관련 현황 안내 접수 신고 업무 운영 기준 대상 방법 사항 경우 지원 확인 조치 발생 시행 등'.split())

def kw_of(title, body):
    """제목에서 찾을 말을 뽑는다. 흔한 말(민원·처리·요령)은 버린다."""
    ks = []
    for w in re.findall(r'[가-힣A-Za-z]{2,}', title):
        if w in STOP or len(w) < 2:
            continue
        ks.append(w)
    # 본문 첫 머리에서 굵직한 명사 몇 개 더
    for w in re.findall(r'[가-힣]{3,}', body[:400]):
        if w in STOP or w in ks:
            continue
        ks.append(w)
        if len(ks) >= 14:
            break
    return ks[:14]

def vendor_of(body):
    """용역업체 — 당직 매뉴얼의 알맹이. 이름과 번호를 함께 집는다.
       느슨하게 잡으면 '업체 측에 …' 같은 문장이 회사 이름 자리에 들어온다."""
    m = (re.search(r"\(\s*용역\s*업체\s*\)\s*([^\n(]{2,24})", body)
         or re.search(r"용역\s*업체\s*명?\s*[:\uff1a]\s*([^\n(]{2,24})", body))
    if not m:
        return None
    nm = m.group(1).strip(" \u00b7-,")
    # 회사 이름은 짧다. 조사가 붙었으면 문장이지 이름이 아니다.
    if len(nm) > 24 or re.search(r"(측에|하여|에게|으로|바랍|한다|합니다|하고)", nm):
        return None
    tel = ""
    t = re.search(r"\(\s*연\s*락\s*처\s*\)\s*([0-9][0-9\-,\s()\uac00-\ud7a3]{6,60})",
                  body[m.end():m.end() + 400])
    if t:
        tel = re.sub(r"\s+", " ", t.group(1)).strip()
    return {"nm": nm, "tel": tel}

def split(md):
    """장의 경계는 '제목 + (소관부서 ☎내선)' 한 칸짜리 표다.
       괄호를 요구하지 않으면 본문 속 한 칸짜리 표(처리절차 ①②③…)까지 장 머리로 오인해
       정작 그 장의 표를 다음 장이 가져간다 — 알맹이가 통째로 빠진다."""
    lines = md.split("\n")
    secs, cur, skip = [], None, 0
    for i, ln in enumerate(lines):
        if skip:
            skip -= 1
            continue
        h = HEAD.match(ln)
        if h and (h.group(2) or "").strip() and lines[i + 1:i + 2] and lines[i + 1].startswith("| ---"):
            title = h.group(1).strip()
            paren = h.group(2).strip()
            if len(title) >= 4 and not re.match(r"^(\uc5f0\s*\ubc88|\u3010|\u274f|\u203b)", title):
                cur = {"t": title, "paren": paren, "lines": []}
                secs.append(cur)
                skip = 1          # 뒤따르는 | --- 줄은 버린다
                continue
        if cur is not None:
            cur["lines"].append(ln)
    return [x for x in secs if len("".join(x["lines"]).strip()) > 40]

BULLET = {"\uf06d": "-", "\uf0a1": "-", "\uf09f": "-", "\uf0d8": "\u25b8",
          "\uf075": "-", "\uf0b7": "\u00b7", "\uf02d": "-"}
def debullet(s):
    for k, v in BULLET.items():
        s = s.replace(k, v)
    return s

def plain(md_lines):
    """검색용 본문 — 표 기호를 걷어 낸 글자만."""
    out = []
    for ln in md_lines:
        s = ln.strip()
        if not s or re.match(r'^\|[\s\-|]+\|$', s):
            continue
        if s.startswith('|'):
            s = ' '.join(x.strip() for x in s.strip('|').split('|') if x.strip())
            s = s.replace('<br>', ' ')
        s = re.sub(r'^#+\s*', '', s)
        if s:
            out.append(s)
    return '\n'.join(out)

def main(src):
    md = io.open(src, encoding='utf-8').read()
    secs = split(md)
    manual, depts = [], []
    for s in secs:
        body_md = debullet('\n'.join(s['lines']).strip('\n'))
        body = debullet(plain(s['lines']))
        if len(body) < 40:
            continue
        dept = team = tel = ''
        if s['paren']:
            d = DEPT.search(s['paren'])
            if d:
                dept, team = d.group(1) or '', d.group(2) or ''
                tel = d.group(3) or ''
            if not tel:
                t = TEL.search(s['paren'])
                if t:
                    tel = t.group(1) or t.group(2) or ''
        manual.append({'t': s['t'], 'd': dept, 'tel': tel, 'b': body, 'md': body_md})
        if dept:
            depts.append({'sec': s['t'], 'dept': dept, 'team': team, 'tel': tel,
                          'vendor': vendor_of(body), 'kw': kw_of(s['t'], body)})
    io.open('data/manual.json', 'w', encoding='utf-8', newline='\n').write(
        json.dumps(manual, ensure_ascii=False, indent=0))
    io.open('data/manual_dept.json', 'w', encoding='utf-8', newline='\n').write(
        json.dumps(depts, ensure_ascii=False, indent=1))
    print('장 %d개 · 소관부서 있는 장 %d개 · 용역업체 %d곳'
          % (len(manual), len(depts), sum(1 for d in depts if d['vendor'])))
    for d in depts[:8]:
        print('   %-34s %s %s %s' % (d['sec'][:32], d['dept'], d['tel'],
                                     (d['vendor']['nm'] + ' ' + d['vendor']['tel']) if d['vendor'] else ''))

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'data/manual_2026.md')
