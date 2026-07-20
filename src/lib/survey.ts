// Post-tournament feedback survey — single source of truth for the question
// list, shared by the /survey page (render) and its action (validation).
//
// Shape per the survey research: all-binary yes/no grouped in 3 short sections
// (10 questions ≈ 40 seconds) + ONE optional free comment at the end. Every
// question key doubles as its i18n key (FR + EN in i18n.svelte.ts) and as the
// jsonb key stored in survey_responses.answers.

export const SURVEY_KEY = 'wc2026';

export const SURVEY_SECTIONS = [
	{
		i18n: 'survey_section_experience',
		questions: ['survey_q_overall', 'survey_q_mobile', 'survey_q_rules']
	},
	{
		i18n: 'survey_section_features',
		questions: ['survey_q_odds', 'survey_q_bonus', 'survey_q_live', 'survey_q_social']
	},
	{
		i18n: 'survey_section_next',
		questions: ['survey_q_notifs', 'survey_q_again', 'survey_q_recommend']
	}
] as const;

export const SURVEY_QUESTIONS = SURVEY_SECTIONS.flatMap((s) => s.questions);
