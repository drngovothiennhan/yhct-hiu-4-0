const CONVERSATION_SELECTOR='.app-assistant-panel .xz-conversation';
const COMPOSER_SELECTOR='.app-assistant-panel .xz-compose';
const LEGACY_EMPTY_COPY_SELECTOR='.app-assistant-panel .xz-empty p';

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

const removeLegacyEmptyCopy=(root:Document|Element)=>{
  if(root instanceof Element&&root.matches(LEGACY_EMPTY_COPY_SELECTOR))root.remove();
  root.querySelectorAll(LEGACY_EMPTY_COPY_SELECTOR).forEach((node)=>node.remove());
};

const containingConversation=(node:Node|null):HTMLElement|null=>{
  const element=node instanceof Element?node:node?.parentElement;
  if(!element)return null;
  if(element.matches(CONVERSATION_SELECTOR))return element as HTMLElement;
  return element.closest<HTMLElement>(CONVERSATION_SELECTOR);
};

const addedConversation=(node:Node):HTMLElement|null=>{
  const direct=containingConversation(node);
  if(direct)return direct;
  return node instanceof Element?node.querySelector<HTMLElement>(CONVERSATION_SELECTOR):null;
};

const scrollOpenConversation=(immediate=false)=>{
  document.querySelectorAll<HTMLElement>(CONVERSATION_SELECTOR).forEach((conversation)=>scrollToLatest(conversation,immediate));
};

const observeConversation=()=>{
  removeLegacyEmptyCopy(document);
  const observer=new MutationObserver((records)=>{
    const conversations=new Set<HTMLElement>();
    for(const record of records){
      const direct=containingConversation(record.target);
      if(direct)conversations.add(direct);
      record.addedNodes.forEach((node)=>{
        if(node instanceof Element)removeLegacyEmptyCopy(node);
        const added=addedConversation(node);
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
