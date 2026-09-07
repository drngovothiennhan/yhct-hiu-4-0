import mammoth from 'mammoth';
self.onmessage=async(event:MessageEvent<ArrayBuffer>)=>{try{const {value}=await mammoth.extractRawText({arrayBuffer:event.data});const text=String(value||'').replace(/\u0000/g,' ').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,60000);self.postMessage({ok:true,text})}catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:'Không thể đọc DOCX.'})}};
export {};
