/**
 * Example descriptions for the studio's "Description" field.
 *
 * The field was blank with only a placeholder before this — which works once a
 * host already knows what a good invite description sounds like, and is a
 * blank wall for anyone who doesn't. These are real, ready-to-use examples a
 * host can drop straight into the card and edit from there, grouped by
 * occasion so the ones offered actually fit what's being thrown.
 *
 * `categories` maps each set to the CATEGORIES ids in templates.js
 * (mehfil/happyhours/wedding/birthday) where a direct match exists. Sets
 * without a clean match (engagement, graduation, house party) carry their own
 * label and are offered regardless of category — a host planning any of those
 * is better served seeing them than seeing nothing.
 */
export const DESCRIPTION_EXAMPLES = [
  {
    id: 'mehfil',
    label: 'Mehfil',
    emoji: '🪔',
    categories: ['mehfil'],
    examples: [
      'An evening for unhurried music, warm chai, and the people who make a room feel like home. Come listen, talk, and stay as long as the night lets us.',
      'We are gathering for a small baithak: live music, something good to eat, and no reason to watch the clock. I saved a place for you.',
      'A little sur, a little shayari, and the company we keep close. Join us for an evening that is meant to be heard slowly.'
    ]
  },
  {
    id: 'birthday',
    label: 'Birthday',
    emoji: '🎂',
    categories: ['birthday'],
    examples: [
      "Happy Birthday to the person who makes getting older look suspiciously good. Another year wiser, another year more experienced at ignoring good advice. Tonight, we celebrate you properly—with cake, drinks, and absolutely no discussion about your age.",
      "Another year around the sun, and somehow you're still everyone's favorite reason to gather. Here's to more laughter, more memories, and enough cake to make tomorrow's regret completely worth it.",
      "Happy Birthday! They say age is just a number, but yours is starting to look like a password nobody should know. Forget the number tonight—come eat cake, make memories, and celebrate another legendary year.",
      "Happy Birthday to someone who deserves a celebration almost as much as they deserve to be reminded that they're getting older. Let's raise a glass, cut some cake, and pretend this whole aging thing is actually going according to plan.",
      "Another birthday, another excuse to bring together the people who make life worth celebrating. Come hungry, come happy, and leave your age at the door. Tonight, we're counting memories—not years."
    ]
  },
  {
    id: 'house-party',
    label: 'House Party',
    emoji: '🏠',
    categories: ['happyhours'],
    examples: [
      "The house is ready, the playlist is questionable, and someone's definitely going to say \u201cjust one more song\u201d at 2 AM. Come over, bring your favorite people, and let's turn an ordinary night into one we'll probably talk about for years.",
      "Consider this your official invitation to temporarily forget responsibilities exist. There's music, there's food, there's good company, and absolutely no guarantee that the neighbors will approve.",
      "Some of the best memories happen when nobody planned them too carefully. So come over, grab a drink, find your spot, and let's make this house a little louder than usual.",
      "No fancy venue. No complicated plans. Just good people, questionable decisions, and a house that's about to have a very long night. You know what to do.",
      "Tonight, the living room is the dance floor, the kitchen is the headquarters, and tomorrow's stories are being written right here. Come make yourself at home—just don't break anything."
    ]
  },
  {
    id: 'engagement',
    label: 'Engagement',
    emoji: '💍',
    categories: [],
    examples: [
      "Two people said yes, and now everyone else gets an excuse to celebrate. Come raise a glass to the beginning of their forever, because apparently one lifetime together wasn't enough—they wanted to make it official.",
      "They found each other, said yes, and somehow made forever sound like a pretty good idea. Join us as we celebrate the beginning of a beautiful new chapter together.",
      "First came the love, then came the question, and thankfully the answer was yes. Now comes the fun part—celebrating with the people who have been cheering them on all along.",
      "Some stories begin with \u201cOnce upon a time.\u201d Theirs began with two people meeting, falling in love, and eventually deciding they were stuck with each other. Come celebrate the happy decision.",
      "They're officially engaged, which means the \u201cAre you two finally getting married?\u201d questions can now be replaced with actual wedding questions. Come celebrate the yes that started it all."
    ]
  },
  {
    id: 'graduation',
    label: 'Graduation',
    emoji: '🎓',
    categories: [],
    examples: [
      "After years of deadlines, sleepless nights, questionable cafeteria food, and asking \u201cwhen will I ever use this?\u201d, the answer is finally: graduation day. Come celebrate the achievement before real life starts asking even more questions.",
      "The assignments are submitted, the exams are over, and somehow the degree actually happened. Join us for one last celebration before the next chapter begins.",
      "They came for the degree, stayed for the memories, and somehow survived everything in between. Now it's time to celebrate a milestone years in the making.",
      "Years of hard work deserve more than a handshake and a piece of paper. So we're throwing a celebration worthy of the journey. Come raise a glass to everything accomplished and everything still to come.",
      "One chapter is officially complete. The next one hasn't been written yet—which is probably a good thing. For now, let's celebrate the achievement, the memories, and the person who made it here."
    ]
  },
  {
    id: 'wedding',
    label: 'Wedding',
    emoji: '💒',
    categories: ['wedding'],
    examples: [
      "They found the person they'd choose again and again, and now they're making it official. Come celebrate the beginning of forever with two people who have already found their favorite place—in each other's lives.",
      "Love brought them together, life brought them here, and now there's only one thing left to do: celebrate properly. Join us as two lives become one beautiful new chapter.",
      "Somewhere between the first hello and the \u201cI do,\u201d they became each other's favorite person. Now it's time for everyone who loves them to come together and celebrate their story.",
      "Today they're saying \u201cI do.\u201d Tonight we're saying \u201clet's celebrate.\u201d Come be part of the laughter, love, music, food, and memories that make this day unforgettable.",
      "A lifetime is a long time to choose someone. Luckily, they found the person they want beside them for all of it. Come celebrate the beginning of their forever."
    ]
  }
];

/**
 * Examples worth showing for a given studio category — filtered, not just
 * re-sorted.
 *
 * The first version of this returned all five sets for every category, only
 * reordered, so picking "Wedding" still showed Birthday and Graduation lines
 * a few scrolls down — technically sorted correctly, but a host who wants
 * wedding lines has no reason to see the other four sets at all. Now:
 *
 *   - A direct category match (categoryId is in set.categories) always shows.
 *   - Sets with no category mapping (engagement, graduation) only show when
 *     nothing directly matched — i.e. for `category === 'all'`, or a category
 *     these examples don't otherwise cover — so they're a fallback, not
 *     permanent noise under every occasion.
 */
export function descriptionExamplesFor(categoryId) {
  const directMatches = DESCRIPTION_EXAMPLES.filter((set) => set.categories.includes(categoryId));
  if (directMatches.length > 0) return directMatches;

  // Nothing mapped to this category — offer the sets that were never mapped
  // to any category (engagement, graduation) instead of showing nothing.
  return DESCRIPTION_EXAMPLES.filter((set) => set.categories.length === 0);
}

/** Short personal notes shown before the event details in the opening scene. */
const SENDER_MESSAGE_EXAMPLES = {
  mehfil: [
    'I have been saving this evening for my favourite people. Come sit with us, listen, and stay awhile.',
    'A little music, good company, and a place for you beside us. I would love to see you there.'
  ],
  wedding: [
    'We would be so happy to have you beside us for this day. Your presence will make it feel complete.',
    'From our family to yours, please come celebrate this new beginning with us.'
  ],
  birthday: [
    'I am bringing my favourite people together for my birthday, and that means you have to be there.',
    'Save the evening for me. There will be cake, music, and a seat waiting just for you.'
  ],
  happyhours: [
    'I am opening the doors and saving you a spot. Bring your stories; I will take care of the chai.',
    'The playlist is ready and the evening is better with you in it. Come by when you can.'
  ]
};

export function senderMessageExamplesFor(categoryId) {
  return SENDER_MESSAGE_EXAMPLES[categoryId] || SENDER_MESSAGE_EXAMPLES.happyhours;
}
