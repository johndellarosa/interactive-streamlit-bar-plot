// Decimal-friendly intervals, independent of the order of magnitude.
export function niceAxis(low, high, target = 5, expand = true, minimumStep = 0) {
  if (!(high > low) || !Number.isFinite(high-low)) return {domain:[low,high], ticks:[low], step:1};
  const raw=(high-low)/Math.max(1,target-1),power=10**Math.floor(Math.log10(raw));
  if (!power) return {domain:[low,high],ticks:[low,high],step:high-low};
  const candidates=[1,2,2.5,5,10].map(n=>n*power);
  let step=candidates.reduce((best,n)=>Math.abs(Math.log(n/raw))<Math.abs(Math.log(best/raw))?n:best);
  step=Math.max(step,minimumStep);
  const clean=v=>Number(v.toPrecision(15));
  let start=expand?clean(Math.floor(low/step+1e-10)*step):low;
  let end=expand?clean(Math.ceil(high/step-1e-10)*step):high;
  // Rounding must never discard an input extremum.
  if(expand && start>low && (start-low)>step*1e-9)start=clean(start-step);
  if(expand && end<high && (high-end)>step*1e-9)end=clean(end+step);
  const first=Math.ceil(start/step-1e-10),last=Math.floor(end/step+1e-10);
  const ticks=Array.from({length:Math.max(0,Math.min(100,last-first+1))},(_,i)=>{
    const v=clean((first+i)*step);return Math.abs(v)<step*1e-10?0:v;
  }).filter(v=>v>=start-step*1e-9&&v<=end+step*1e-9);
  return {domain:[start,end],ticks,step};
}
