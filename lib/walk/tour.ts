/**
 * The guided tour's stops, in walking order from the main gate. Shared by the game (the 🧭 tour) and the Plan your
 * visit page, so both walk the same route. Each stop's text is Walk.ui.tour_<id> in the messages.
 */
export const TOUR_STOPS = ["gate", "university-building", "library", "clock-tower", "java", "tech-park", "auditorium", "paari", "hospital", "potheri"] as const;
