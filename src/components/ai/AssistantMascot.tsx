export type AssistantAvatarStyle='default'|'eagle'|'viet'|'minimal';

export default function AssistantMascot({variant='default'}:{variant?:AssistantAvatarStyle}){
  const viet=variant==='viet',eagle=variant==='eagle',minimal=variant==='minimal';
  return <svg className={`assistant-mascot assistant-mascot--${variant}`} viewBox="0 0 64 64" role="img" aria-label="Biểu tượng trợ lý HIU YHCT">
    <circle cx="32" cy="32" r="29" className="assistant-mascot__halo"/>
    {viet&&<><path d="M12 23Q32 7 52 23Q32 18 12 23Z" className="assistant-mascot__hat"/><path d="M18 23H46" className="assistant-mascot__hatline"/></>}
    <path d="M16 31Q18 18 32 17Q46 18 48 31Q46 48 32 52Q18 48 16 31Z" className="assistant-mascot__head"/>
    {!minimal&&<path d="M21 25Q27 19 31 23Q25 25 21 30Z" className="assistant-mascot__brow"/>}
    {!minimal&&<path d="M43 25Q37 19 33 23Q39 25 43 30Z" className="assistant-mascot__brow"/>}
    <circle cx="26" cy="30" r="2.6" className="assistant-mascot__eye"/><circle cx="38" cy="30" r="2.6" className="assistant-mascot__eye"/>
    <path d="M28 34L32 31L40 35L32 41L25 36Z" className="assistant-mascot__beak"/>
    <path d="M21 42Q32 50 43 42Q40 55 32 57Q24 55 21 42Z" className={eagle?'assistant-mascot__scarf':'assistant-mascot__chest'}/>
    {eagle&&<path d="M31 45L34 45L35 51L32 54L29 51Z" className="assistant-mascot__gold"/>}
    {variant==='default'&&<><circle cx="47" cy="17" r="4" className="assistant-mascot__ai-dot"/><path d="M47 14V20M44 17H50" className="assistant-mascot__ai-line"/></>}
    {minimal&&<path d="M18 35Q12 38 9 45M46 35Q52 38 55 45" className="assistant-mascot__wingline"/>}
  </svg>;
}
