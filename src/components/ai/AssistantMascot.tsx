export type AssistantAvatarStyle='default'|'eagle'|'viet'|'minimal';

export default function AssistantMascot({variant='default'}:{variant?:AssistantAvatarStyle}){
  return <img
    className={`assistant-mascot assistant-mascot--${variant}`}
    src="/assets/ai/assistant-leaf-mascot.svg"
    alt="Trợ lý HIU YHCT"
    draggable={false}
    decoding="async"
  />;
}
