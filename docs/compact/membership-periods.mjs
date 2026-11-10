// Verified against month-by-month clan battle roster archives (2020-02..2026-08).
// Months with lost source records (2020-03, 2020-05, early 2019) are NOT
// assumed to be absences. Excluded intervals represent missing roster entries,
// not independently proven dates of leaving the in-game clan.
// 2020-01 dormancy counts toward membership for members enrolled during that month.
export const MEMBERSHIP_ROSTER_GAPS = {
  "119821969218": [
    [
      "2020-06",
      "2022-05"
    ]
  ],
  "657721937738": [
    [
      "2020-02",
      "2020-02"
    ],
    [
      "2020-12",
      "2021-02"
    ]
  ],
  "696721935558": [
    [
      "2020-04",
      "2020-04"
    ],
    [
      "2020-06",
      "2020-07"
    ]
  ],
  "976721973158": [
    [
      "2020-11",
      "2020-11"
    ]
  ],
  "271821989538": [
    [
      "2020-02",
      "2020-02"
    ]
  ],
  "398721934648": [
    [
      "2020-02",
      "2020-02"
    ]
  ],
  "856721913778": [
    [
      "2021-05",
      "2025-02"
    ]
  ],
  "236721957548": [
    [
      "2021-04",
      "2021-04"
    ],
    [
      "2025-06",
      "2025-08"
    ],
    [
      "2026-07",
      "2026-07"
    ]
  ],
  "466721949368": [
    [
      "2021-04",
      "2021-04"
    ]
  ],
  "949222961519": [
    [
      "2021-05",
      "2022-01"
    ]
  ],
  "369821978628": [
    [
      "2021-11",
      "2021-12"
    ],
    [
      "2022-06",
      "2022-06"
    ]
  ],
  "919122969419": [
    [
      "2021-04",
      "2021-04"
    ]
  ],
  "658721951198": [
    [
      "2021-09",
      "2021-09"
    ],
    [
      "2022-02",
      "2022-11"
    ],
    [
      "2023-06",
      "2023-06"
    ]
  ],
  "291922998329": [
    [
      "2021-09",
      "2021-10"
    ]
  ],
  "138721924868": [
    [
      "2022-10",
      "2022-11"
    ]
  ],
  "716721947178": [
    [
      "2022-10",
      "2023-07"
    ],
    [
      "2024-02",
      "2024-02"
    ]
  ],
  "926721937658": [
    [
      "2023-06",
      "2023-07"
    ],
    [
      "2024-12",
      "2024-12"
    ]
  ],
  "256721988748": [
    [
      "2023-02",
      "2023-05"
    ]
  ],
  "349821948518": [
    [
      "2023-04",
      "2023-05"
    ],
    [
      "2023-08",
      "2023-08"
    ],
    [
      "2025-01",
      "2025-01"
    ]
  ],
  "893922938319": [
    [
      "2024-04",
      "2024-11"
    ]
  ],
  "917922926721": [
    [
      "2024-12",
      "2024-12"
    ]
  ],
  "658821931748": [
    [
      "2025-10",
      "2025-12"
    ]
  ]
};
const monthIndex = value => {
  const m = /^(\d{4})-(0[1-9]|1[0-2])/.exec(String(value||''));
  return m ? Number(m[1])*12 + Number(m[2])-1 : null;
};
const fromMonthIndex = index => String(Math.floor(index/12)).padStart(4,'0')+'-'+String(index%12+1).padStart(2,'0');
export function verifiedMembershipPeriods(member) {
  const raw = Array.isArray(member.periods)&&member.periods.length ? member.periods : [{from:member.joined,to:member.left||null}];
  const removed=(MEMBERSHIP_ROSTER_GAPS[String(member.uid||'').replace(/\D/g,'')]||[]).map(([start,end])=>[monthIndex(start),monthIndex(end)]);
  const spans=[];
  for(const p of raw){
    const start=monthIndex(p.from),end=monthIndex(p.to);
    if(start===null||end!==null&&end<start)continue;
    let segments=[[start,end===null?Infinity:end]];
    for(const [cutStart,cutEnd] of removed){
      const next=[];
      for(const [a,b] of segments){
        if(cutEnd<a||cutStart>b)next.push([a,b]);
        else {
          if(a<cutStart)next.push([a,cutStart-1]);
          if(cutEnd<b)next.push([cutEnd+1,b]);
        }
      }
      segments=next;
    }
    spans.push(...segments);
  }
  // Older synced records had this month wrongly removed; restore it without
  // changing other recorded hiatuses.
  const dormantMonth=monthIndex('2020-01');
  const joined=monthIndex(member.joined),left=monthIndex(member.left);
  if(joined!==null&&joined<=dormantMonth&&(left===null||left>=dormantMonth)){
    spans.push([dormantMonth,dormantMonth]);
  }
  spans.sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const [a,b] of spans){
    const prior=merged[merged.length-1];
    if(prior&&a<=prior[1]+1)prior[1]=Math.max(prior[1],b);
    else merged.push([a,b]);
  }
  return merged.map(([a,b])=>({from:fromMonthIndex(a),to:b===Infinity?null:fromMonthIndex(b)}));
}
export function verifiedMembershipMonths(member,asOf=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}).slice(0,7)) {
  const limit=monthIndex(asOf);
  if(limit===null)return null;
  const spans=verifiedMembershipPeriods(member);
  if(!spans.length)return null;
  return spans.reduce((sum,p)=>{
    const a=monthIndex(p.from),b=p.to?monthIndex(p.to):limit;
    return sum+(b>=a?Math.max(0,Math.min(b,limit)-a+1):0);
  },0);
}
export function verifiedMembershipPeriodLabel(member) {
  return verifiedMembershipPeriods(member).map(p=>p.from.replace('-','.')+'–'+(p.to?p.to.replace('-','.'):'현재')).join(' / ')||'미기재';
}
