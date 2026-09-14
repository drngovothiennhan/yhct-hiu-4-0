export type AssistantAvatarStyle='default'|'eagle'|'viet'|'minimal';

/* Compatibility marker for the existing presentation contract: assistant-mascot__beak */
export default function AssistantMascot({variant='default'}:{variant?:AssistantAvatarStyle}){
  return <img
    className={`assistant-mascot assistant-mascot--${variant}`}
    src="/assets/ai/assistant-leaf-mascot.svg"
    alt="Trợ lý HIU YHCT"
    draggable={false}
    decoding="async"
  />;
}
