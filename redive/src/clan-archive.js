// Curated from the original October 2026 workbook, DB!I6:R92.
// Membership-count notes are intentionally excluded from this editorial timeline.
const CLAN_ARCHIVE_SOURCE='https://docs.google.com/spreadsheets/d/1qIxlOewmyRNhMWwLLhNw6PPbPf7fhpmdExRrlJFBLRw/edit#gid=1411801387';
const CLAN_ARCHIVE_EVENTS=[
 ['2019-07','시작','냥냥클랜 결성','메코를 초대 클랜장으로, 냥냥클랜의 첫 기록이 시작됐다.'],
 ['2019-08','기록','첫 번째 기록 암흑기','원본 DB에 기록 공백으로 남아 있는 시기. 남아 있는 연혁을 통해 초기의 발자취를 이어 간다.'],
 ['2020-01','전환','첫 번째 동면','첫 해산과 함께 잠시 동면에 들어갔다.'],
 ['2020-02','재결성','리다이브','냥냥클랜이 다시 모여 리다이브를 시작했다.'],
 ['2020-03','기록','두 번째 기록 암흑기','재결성 뒤에도 일부 기록이 유실된 시기가 원본에 남아 있다.'],
 ['2020-10','전투','이월 조합 변경 도입','이월에서 조합을 변경하는 방식이 도입됐다.'],
 ['2021-03','전환','두 번째 해산','클랜이 두 번째 해산을 맞았다.'],
 ['2021-04','재결성','리리다이브','다시 모인 냥냥클랜. 리리다이브라는 이름으로 역사를 이어 갔다.'],
 ['2021-05','운영','2대 클랜장 앨리스','앨리스가 두 번째 클랜장을 맡았다.'],
 ['2021-09','사람','사쿠라 은퇴','원본 연혁에 사쿠라의 은퇴가 기록됐다.'],
 ['2022-03','운영','메코, 다시 클랜장으로','메코가 클랜장으로 복귀했다.'],
 ['2022-06','전투','동시타격 도입','클랜전의 동시타격 방식이 도입됐다.'],
 ['2022-07','전투','랭크 보정과 TP 상한','랭크 보정과 TP 상한 도입이 클랜전의 새로운 기준이 됐다.'],
 ['2022-08','전환','노루지부 해산','원본 DB에 노루지부의 해산이 기록됐다.'],
 ['2022-12','운영','앨리스, 다시 클랜장으로','앨리스가 다시 클랜장을 맡았다.'],
 ['2023-01','전투','SET 도입과 회차 조정','SET 기능 도입과 회차 조정으로 전투 환경이 바뀌었다.'],
 ['2023-05','사람','메코 은퇴','메코의 은퇴가 연혁의 한 페이지로 남았다.'],
 ['2023-08','사람','메코 복귀','메코가 다시 클랜으로 돌아왔다.'],
 ['2024-05','전투','회차 대격변','회차 체계가 크게 바뀌고 5단계가 삭제됐다.'],
 ['2024-08','기록 갱신','처음으로 IN 5','클랜 순위 5위. 처음으로 다섯 손가락 안에 이름을 올렸다.'],
 ['2024-10','전투','1단계 스킵 도입','회차 조정과 함께 1단계 스킵이 도입됐다.'],
 ['2025-02','기록 갱신','최고 순위 4위','클랜 최고 순위를 4위로 새로 썼다.'],
 ['2025-03','전투','심역 업데이트','원본 연혁에 심역 업데이트가 기록됐다.'],
 ['2025-05','기록 갱신','최고 순위 3위','클랜 최고 순위가 3위로 올라섰다.'],
 ['2025-09','전환','토아 해산 이후','토아 해산 이후의 첫 클랜전을 치렀다.'],
 ['2025-10','기록 갱신','최고 순위 2위','클랜 최고 순위를 다시 한 번 갱신했다.'],
 ['2025-11','전투','궁극 연성 업데이트','궁극 연성 업데이트가 새로운 전투 환경의 이정표로 남았다.']
];
subpageNames.records.chronicle='아카이브';copyRegistry.add('아카이브');
function completeClanArchive(){
 const years=[...new Set(CLAN_ARCHIVE_EVENTS.map(e=>e[0].slice(0,4)))];
 const items=years.map(year=>'<section class="clan-archive-year" id="clan-archive-'+year+'" aria-labelledby="clan-archive-title-'+year+'"><h2 id="clan-archive-title-'+year+'">'+year+'<small>냥냥클랜의 기록</small></h2><ol>'+CLAN_ARCHIVE_EVENTS.filter(e=>e[0].startsWith(year)).map(([date,tag,title,body])=>'<li class="'+(tag==='기록 갱신'?'is-milestone':'')+'"><div class="archive-event-date"><time datetime="'+date+'">'+date.replace('-','.')+'</time><span>'+tag+'</span></div><div class="archive-event-copy"><h3>'+title+'</h3><p>'+body+'</p></div></li>').join('')+'</ol></section>').join('');
 return '<article class="clan-archive"><header class="clan-archive-intro"><div><span class="archive-eyebrow">NYANGNYANG CLAN · SINCE 2019</span><h2>다시 모여,<br>이어 온 이야기.</h2><p>결성과 동면, 두 번의 재결성.<br>함께 쌓아 온 냥냥클랜의 굵직한 순간들을 펼칩니다.</p></div><div class="archive-highlight"><span>기록으로 남은 최고 순위</span><strong>2<small>위</small></strong><time datetime="2025-10">2025년 10월 달성</time></div></header><nav class="archive-year-nav" aria-label="연혁 연도">'+years.map(year=>'<a href="#clan-archive-'+year+'" data-action="clan-archive-year" data-value="'+year+'">'+year+'</a>').join('')+'</nav><div class="clan-archive-timeline">'+items+'</div><footer class="clan-archive-source"><p>원본 DB에 남은 사건을 중심으로 정리했습니다. 연혁이 기재되지 않은 기간은 생략했습니다.</p><a class="button" target="_blank" rel="noopener noreferrer" href="'+CLAN_ARCHIVE_SOURCE+'">원본 DB 보기</a></footer></article>';
}
document.addEventListener('click',event=>{const link=event.target.closest('[data-action="clan-archive-year"]');if(!link)return;event.preventDefault();event.stopImmediatePropagation();document.getElementById('clan-archive-'+link.dataset.value)?.scrollIntoView({behavior:'smooth',block:'start'});},true);
