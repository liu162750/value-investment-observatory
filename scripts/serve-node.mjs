import {createServer} from 'node:http';
import worker, {goldDashboard,history,stocks,technical,swingCandidates} from '../dist/server/index.js';
const port=Number(process.env.PORT||3000);
// Never start an externally hosted server with the access gate disabled.
if(!process.env.PHONE_ALLOWED_HASHES||!process.env.PHONE_SESSION_SECRET)throw new Error('Phone access secrets required');
createServer(async(req,res)=>{
 try{
  const origin=process.env.PUBLIC_ORIGIN;
  if(!origin){res.writeHead(503);res.end('Public origin not configured');return;}
  const body=[];for await(const chunk of req)body.push(chunk);
  const init={method:req.method,headers:req.headers};
  if(req.method!=='GET'&&req.method!=='HEAD')init.body=Buffer.concat(body);
  const request=new Request(new URL(req.url,origin),init);
  const response=await worker.fetch(request,{...process.env,PHONE_GATE_ENABLED:'1'});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('Request failed:',error.message);res.writeHead(500);res.end('Request failed');}
}).listen(port,'0.0.0.0',()=>console.log('Dashboard server ready'));

goldDashboard().then(g=>console.log('Gold source check:',JSON.stringify({price:g.price,change:g.change,previousClose:g.previousClose,quoteTime:g.quoteTime||null,levelDate:g.levelDate||g.date,quoteError:g.quoteError,source:g.source}))).catch(e=>console.warn('Gold source check failed:',e.message));

Promise.all(stocks.map(async s=>{try{const rows=await history(s.symbol),tech=technical(rows);console.log('Stock history check:',JSON.stringify({symbol:s.symbol,count:rows.length,date:tech?.date,fallback:rows.historyStale===true,levels:swingCandidates(rows,tech,s.levels,s.sellReference)}));}catch(e){console.warn('Stock history check failed:',s.symbol,e.message);}}));
