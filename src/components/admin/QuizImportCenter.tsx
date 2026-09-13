import LearningContentManagerPanel from './LearningContentManagerPanel';

/**
 * Compatibility entry retained for ACC routing only.
 * The canonical quiz-bank manager is LearningContentManagerPanel; keeping this
 * wrapper prevents a second/legacy quiz workflow from diverging again.
 */
export default function QuizImportCenter(){
  return <LearningContentManagerPanel/>;
}
