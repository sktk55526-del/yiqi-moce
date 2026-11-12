'use strict';
// Browser image requests must survive slow mobile transfers. A soft deadline
// reports progress without discarding a later successful load.
function createImages({createImage=()=>new Image(),concurrency=3,slowMs=12000,timeoutMs=60000,retryDelays=[1000,3000],schedule=setTimeout,cancel=clearTimeout}={}) {
  const jobs=new Map(),ready=new Map(),listeners=new Set();let active=0,disposed=false;
  function status(){return {pending:[...jobs.values()].filter(j=>j.state!=='failed').length,failed:[...jobs.values()].filter(j=>j.state==='failed').length,slow:[...jobs.values()].some(j=>j.slow)};}
  function changed(){for(const fn of listeners)fn(status());}
  function pump(){if(disposed)return;for(const job of jobs.values()){if(active>=concurrency)break;if(job.state==='queued')start(job);}}
  function start(job){
    active++;job.state='loading';job.attempt++;job.slow=false;let image,soft,hard,ended=false;
    const finish=success=>{
      if(ended)return;ended=true;cancel(soft);cancel(hard);if(image)image.onload=image.onerror=null;active--;job.abort=null;
      if(success){
        jobs.delete(job.src);ready.set(job.src,image);while(ready.size>8)ready.delete(ready.keys().next().value);
        for(const cb of job.callbacks)cb(image);
      }else if(job.attempt<=retryDelays.length){
        job.state='retrying';job.timer=schedule(()=>{job.timer=null;job.state='queued';changed();pump();},retryDelays[job.attempt-1]);
      }else{job.state='failed';for(const cb of job.callbacks)cb(null);}
      changed();pump();
    };
    job.abort=()=>{if(ended)return;ended=true;cancel(soft);cancel(hard);if(image){image.onload=image.onerror=null;image.src='';}active--;};
    soft=schedule(()=>{job.slow=true;changed();},slowMs);
    hard=schedule(()=>{if(image){image.onload=image.onerror=null;image.src='';}finish(false);},timeoutMs);
    try{image=createImage();image.decoding='async';image.fetchPriority=/home-(compact|wordmark)/.test(job.src)?'high':'auto';image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=job.src;}catch{finish(false);}
    changed();
  }
  function retry(){for(const j of jobs.values())if(j.state==='failed'||j.state==='retrying'){cancel(j.timer);j.timer=null;j.attempt=0;j.state='queued';}changed();pump();}
  return {
    load(src,done){if(disposed)return;if(ready.has(src)){done(ready.get(src));return;}let job=jobs.get(src);if(job){job.callbacks.add(done);if(job.state==='failed')retry();return;}
      job={src,callbacks:new Set([done]),state:'queued',attempt:0,slow:false};jobs.set(src,job);pump();},
    retry,status,subscribe(fn){listeners.add(fn);fn(status());return()=>listeners.delete(fn);},
    dispose(){disposed=true;for(const j of jobs.values()){cancel(j.timer);j.abort?.();}jobs.clear();ready.clear();listeners.clear();},
  };
}
module.exports={createImages};
