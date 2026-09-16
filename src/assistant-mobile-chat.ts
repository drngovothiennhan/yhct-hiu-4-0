const CONVERSATION_SELECTOR='.app-assistant-panel .xz-conversation';
const COMPOSER_SELECTOR='.app-assistant-panel .xz-compose';

let scrollFrame=0;

const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;

const scrollToLatest=(conversation:HTMLElement,immediate=false)=>{
  window.cancelAnimationFrame(scrollFrame);
  scrollFrame=window.requestAnimationFrame(()=>{
    window.requestAnimationFrame(()=>{
      if(!conversation.isConnected)return;
      conversation.scrollTo({
        top:conversation.scrollHeight,
        behavior:immediate||prefersReducedMotion()?'auto':'smooth',
      });
    });
  });
};

const conversationFromNode=(node:Node|null):HTMLElement|null=>{
  const element=node instanceof Element?node:node?.parentElement;
  if(!element)return null;
  if(element.matches(CONVERSATION_SELECTOR))return element as HTMLElement;
  const parent=element.closest(CONVERSATION_SELECTOR);
  if(parent)return parent as HTMLElement;
  return element.querySelector<HTMLElement>(CONVERSATION_SELECTOR);
};

const scrollOpenConversation=(immediate=false)=>{
  document.querySelectorAll<HTMLElement>(CONVERSATION_SELECTOR).forEach((conversation)=>scrollToLatest(conversation,immediate));
};

const observeConversation=()=>{
  const observer=new MutationObserver((records)=>{
    const conversations=new Set<HTMLElement>();
    for(const record of records){
      const direct=conversationFromNode(record.target);
      if(direct)conversations.add(direct);
      record.addedNodes.forEach((node)=>{
        const added=conversationFromNode(node);
        if(added)conversations.add(added);
      });
    }
    conversations.forEach((conversation)=>scrollToLatest(conversation));
  });

  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  scrollOpenConversation(true);
};

if(document.body)observeConversation();
else window.addEventListener('DOMContentLoaded',observeConversation,{once:true});

const viewport=window.visualViewport;
if(viewport){
  viewport.addEventListener('resize',()=>scrollOpenConversation(true),{passive:true});
  viewport.addEventListener('scroll',()=>scrollOpenConversation(true),{passive:true});
}

document.addEventListener('focusin',(event)=>{
  const target=event.target;
  if(!(target instanceof Element)||!target.closest(COMPOSER_SELECTOR))return;
  window.setTimeout(()=>scrollOpenConversation(true),80);
  window.setTimeout(()=>scrollOpenConversation(true),260);
});
