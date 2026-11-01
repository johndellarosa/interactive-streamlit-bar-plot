export function quantile(sorted,p) {
  if(!sorted.length)return null;
  const i=(sorted.length-1)*p,k=Math.floor(i),f=i-k;
  return sorted[k]*(1-f)+sorted[Math.min(k+1,sorted.length-1)]*f;
}
export function distribution(values) {
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  if(!n)return null;
  const q1=quantile(sorted,.25),median=quantile(sorted,.5),q3=quantile(sorted,.75),iqr=q3-q1;
  return {n,q1,median,q3,low:sorted.find(v=>v>=q1-1.5*iqr),high:sorted.findLast(v=>v<=q3+1.5*iqr),
    mean:sorted.reduce((s,v)=>s+v/n,0),min:sorted[0],max:sorted.at(-1)};
}
export function density(values,domain,smoothing=1) {
  if(values.length<2 || Math.min(...values)===Math.max(...values))return [];
  // Work in unit coordinates to avoid magnitude-dependent variance underflow.
  const span=domain[1]-domain[0],v=values.map(x=>(x-domain[0])/span),summary=distribution(v),n=v.length;
  const sd=Math.sqrt(v.reduce((s,x)=>s+(x-summary.mean)**2/(n-1),0));
  const robust=(summary.q3-summary.q1)/1.34;
  const scale=robust>0?Math.min(sd,robust):sd;
  const bandwidth=Math.max(1e-5,.9*scale*Math.pow(n,-.2)*smoothing);
  const samples=Array.from({length:161},(_,i)=>{
    const x=i/160,y=v.reduce((s,p)=>s+Math.exp(-.5*((x-p)/bandwidth)**2),0)/n/bandwidth;
    return [domain[0]+x*span,y];
  });
  const peak=Math.max(...samples.map(p=>p[1]));
  return samples.map(([x,y])=>[x,peak?y/peak:0]);
}

