import 'dotenv/config';

import {
  FileType,
  PrismaClient,
  ReferenceType,
  RelationType,
  Role,
  Status,
} from '../src/generated/prisma/client';

import { createPrismaMariaDbAdapter } from '../src/prisma/create-mariadb-adapter';

const prisma = new PrismaClient({
  adapter: createPrismaMariaDbAdapter(),
});

const seededUsers = [
  {
    name: 'Nwed Nyin Admin',
    email: 'admin@nwednyin.local',
    password: 'change-me-in-development',
    role: Role.ADMIN,
    img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
  },
  {
    name: 'Nwed Nyin Editor',
    email: 'editor@nwednyin.local',
    password: 'change-me-in-development',
    role: Role.EDITOR,
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
  },
];

const categoryNames = ['Language', 'Culture', 'History', 'Learning'];
const tagNames = [
  'ibibio',
  'efik',
  'dictionary',
  'oral-history',
  'language-learning',
  'culture',
];
const partOfSpeechNames = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'particle',
];

const seededArticles = [
  {
    title: 'Getting Started With Ibibio Everyday Words',
    slug: 'getting-started-with-ibibio-everyday-words',
    summary:
      'A practical introduction to common Ibibio words and the habits that make daily language learning easier.',
    categories: ['Language', 'Learning'],
    tags: ['ibibio', 'dictionary', 'language-learning'],
    readTime: 4,
    complexity: 'beginner',
    image: {
      url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
      filename: 'ibibio-everyday-words.jpg',
      caption: 'A notebook for daily vocabulary practice.',
      credit: 'Unsplash',
      altText: 'Open notebook beside a cup on a desk',
      size: 248000,
      mimetype: 'image/jpeg',
    },
    sections: [
      {
        title: 'Start With Useful Words',
        content:
          'Choose words you can use immediately at home, in greetings, and in short conversations.',
      },
      {
        title: 'Practice In Small Sets',
        content:
          'A small daily list is easier to remember than a long list reviewed only once.',
      },
    ],
    references: [
      {
        citation: 'Nwed Nyin editorial notes on beginner vocabulary practice.',
        url: 'https://nwednyin.local/articles/getting-started-with-ibibio-everyday-words',
      },
    ],
    markdown: `# Getting Started With Ibibio Everyday Words

Learning begins with words that show up in ordinary life. Start with greetings, family words, common objects, and verbs that describe daily action.

## Start With Useful Words

Choose words you can use immediately at home, in greetings, and in short conversations. Useful words become memorable because they are tied to real situations.

## Practice In Small Sets

Review five to ten words at a time. Say each word aloud, write one short sentence, and return to the same set the next day before adding more.

## Build A Habit

The strongest language habit is consistency. A few minutes every day will do more than a long session once in a while.
`,
  },
  {
    title: 'Why Oral History Matters',
    slug: 'why-oral-history-matters',
    summary:
      'Oral history keeps family memory, community knowledge, and local expressions available for the next generation.',
    categories: ['Culture', 'History'],
    tags: ['oral-history', 'culture', 'efik', 'ibibio'],
    readTime: 5,
    complexity: 'beginner',
    image: {
      url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      filename: 'oral-history-matters.jpg',
      caption: 'Community memory is carried through conversation.',
      credit: 'Unsplash',
      altText: 'People gathered outdoors in warm evening light',
      size: 312000,
      mimetype: 'image/jpeg',
    },
    sections: [
      {
        title: 'Memory Lives In Speech',
        content:
          'Stories preserve names, places, lessons, and expressions that may never appear in formal archives.',
      },
      {
        title: 'Record With Care',
        content:
          'Good oral history work asks permission, preserves context, and respects the speaker.',
      },
    ],
    references: [
      {
        citation: 'Nwed Nyin editorial guide to community oral history.',
        url: 'https://nwednyin.local/articles/why-oral-history-matters',
      },
    ],
    markdown: `# Why Oral History Matters

Oral history keeps family memory, community knowledge, and local expressions available for the next generation.

## Memory Lives In Speech

Stories preserve names, places, lessons, and expressions that may never appear in formal archives. They also carry tone, rhythm, and meaning that plain transcription can miss.

## Record With Care

Ask permission before recording. Note the speaker, place, date, and language variety. Preserve the full context so the story can be understood later.

## Share Responsibly

Some stories are public, while others belong to a family or group. A good archive respects that difference.
`,
  },
  {
    title: 'Using A Dictionary For Better Writing',
    slug: 'using-a-dictionary-for-better-writing',
    summary:
      'A dictionary is more than a lookup tool; it can help writers choose precise words and build stronger sentences.',
    categories: ['Language', 'Learning'],
    tags: ['dictionary', 'language-learning'],
    readTime: 3,
    complexity: 'beginner',
    image: {
      url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80',
      filename: 'dictionary-better-writing.jpg',
      caption: 'Reference books support careful writing.',
      credit: 'Unsplash',
      altText: 'Bookshelves filled with reference books',
      size: 286000,
      mimetype: 'image/jpeg',
    },
    sections: [
      {
        title: 'Read The Examples',
        content:
          'Examples show how a word behaves in a sentence, not only what it means.',
      },
      {
        title: 'Compare Related Words',
        content:
          'Synonyms, antonyms, and related entries help writers choose the closest meaning.',
      },
    ],
    references: [
      {
        citation: 'Nwed Nyin editorial notes on dictionary-based writing.',
        url: 'https://nwednyin.local/articles/using-a-dictionary-for-better-writing',
      },
    ],
    markdown: `# Using A Dictionary For Better Writing

A dictionary is more than a lookup tool. It can help writers choose precise words and build stronger sentences.

## Read The Examples

Definitions explain meaning, but examples show use. Read the example sentence before choosing a word for your own writing.

## Compare Related Words

Synonyms, antonyms, and related entries help writers choose the closest meaning. They also reveal small differences between words that seem similar.

## Return Often

Good writing improves through repeated checking. Use the dictionary during drafting and again during editing.
`,
  },
  {
    title: 'Preserving Words Through Community Contribution',
    slug: 'preserving-words-through-community-contribution',
    summary:
      'Community contributions help preserve local vocabulary, pronunciation, and meaning across dialects.',
    categories: ['Culture', 'Language'],
    tags: ['dictionary', 'culture', 'ibibio', 'efik'],
    readTime: 4,
    complexity: 'intermediate',
    image: {
      url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
      filename: 'community-contribution.jpg',
      caption: 'Language preservation grows through shared work.',
      credit: 'Unsplash',
      altText: 'People collaborating around a table',
      size: 338000,
      mimetype: 'image/jpeg',
    },
    sections: [
      {
        title: 'Local Knowledge Is Specific',
        content:
          'A word can carry different shades of meaning across families, towns, or dialect areas.',
      },
      {
        title: 'Good Entries Need Evidence',
        content:
          'A strong entry includes meaning, example usage, pronunciation, and contributor context.',
      },
    ],
    references: [
      {
        citation: 'Nwed Nyin editorial guide to community submissions.',
        url: 'https://nwednyin.local/articles/preserving-words-through-community-contribution',
      },
    ],
    markdown: `# Preserving Words Through Community Contribution

Community contributions help preserve local vocabulary, pronunciation, and meaning across dialects.

## Local Knowledge Is Specific

A word can carry different shades of meaning across families, towns, or dialect areas. Contributors make those differences visible.

## Good Entries Need Evidence

A strong entry includes meaning, example usage, pronunciation, and contributor context. When possible, include who provided the word and where it is commonly used.

## Review Keeps Quality High

Editorial review helps the dictionary stay useful while still welcoming new voices.
`,
  },
];

const seededWords = [
  {
    term: 'abasi',
    pronunciation: 'ah-bah-see',
    etymology: 'Commonly used in religious and cultural speech.',
    alt_spelling: 'Abasi',
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'God; the Supreme Being.',
        examples: ['Abasi anam eti utom ke uwem nnyin.'],
        synonyms: ['creator'],
        antonyms: [],
      },
    ],
  },
  {
    term: 'ima',
    pronunciation: 'ee-mah',
    etymology: 'Used in speech about affection, care, and goodwill.',
    alt_spelling: null,
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'Love, affection, or deep care for another person.',
        examples: ['Ima edi akpan n̄kpọ ke ufọk.'],
        synonyms: ['affection', 'care'],
        antonyms: ['hatred'],
      },
    ],
  },
  {
    term: 'mbuk',
    pronunciation: 'm-book',
    etymology: 'A common word for narrated events and reports.',
    alt_spelling: null,
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'Story, news, or an account of something that happened.',
        examples: ['Ete ama ọdọhọ mbuk oro ke usenubọk.'],
        synonyms: ['story', 'report'],
        antonyms: [],
      },
    ],
  },
  {
    term: 'ufok',
    pronunciation: 'oo-fok',
    etymology: 'Often used for a house, home, or household setting.',
    alt_spelling: 'ufọk',
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'House, home, or a place where people live.',
        examples: ['Ami ndu ke ufok nnyin.'],
        synonyms: ['home'],
        antonyms: [],
      },
    ],
  },
  {
    term: 'utom',
    pronunciation: 'oo-tom',
    etymology: 'Used for work, duty, or purposeful activity.',
    alt_spelling: 'utọm',
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'Work, task, duty, or service.',
        examples: ['Utom emi oyom ifiok ye ime.'],
        synonyms: ['task', 'service'],
        antonyms: ['rest'],
      },
    ],
  },
  {
    term: 'mmong',
    pronunciation: 'mmong',
    etymology: 'Basic everyday vocabulary for water and liquid.',
    alt_spelling: 'mmọn̄',
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'Water.',
        examples: ['Yak nnyin inwọ mmong.'],
        synonyms: ['water'],
        antonyms: [],
      },
    ],
  },
  {
    term: 'eti',
    pronunciation: 'eh-tee',
    etymology: 'Used to describe goodness, quality, or positive character.',
    alt_spelling: null,
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'adjective',
        meaning: 'Good, fine, proper, or beneficial.',
        examples: ['Emi edi eti mbuk.'],
        synonyms: ['good', 'proper'],
        antonyms: ['bad'],
      },
    ],
  },
  {
    term: 'sosongo',
    pronunciation: 'so-song-go',
    etymology: 'A common expression of gratitude.',
    alt_spelling: null,
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'particle',
        meaning: 'Thank you; an expression of gratitude.',
        examples: ['Sosongo ke mmo enyene ufọn.'],
        synonyms: ['thanks'],
        antonyms: [],
      },
    ],
  },
  {
    term: 'ami',
    pronunciation: 'ah-mee',
    etymology: 'Personal pronoun used by the speaker.',
    alt_spelling: null,
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'I or me; the speaker referring to themself.',
        examples: ['Ami mmefiọk ikọ emi.'],
        synonyms: ['I', 'me'],
        antonyms: [],
      },
    ],
  },
  {
    term: 'nyin',
    pronunciation: 'nyeen',
    etymology: 'Personal pronoun used for a group including the speaker.',
    alt_spelling: null,
    dialect: 'Ibibio',
    accent: 'Uyo',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'We or us; a group including the speaker.',
        examples: ['Nyin imekpep ikọ nnyin.'],
        synonyms: ['we', 'us'],
        antonyms: [],
      },
    ],
  },
];

const wordRelations = [
  ['ufok', 'nyin', RelationType.COMPOUND],
  ['ima', 'eti', RelationType.DERIVED],
  ['mbuk', 'utom', RelationType.ROOT],
  ['ami', 'nyin', RelationType.VARIANT],
] as const;

async function seedUsers() {
  const users = await Promise.all(
    seededUsers.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          password: user.password,
          role: user.role,
          img: user.img,
          active: true,
          verified_at: new Date('2025-01-01T00:00:00.000Z'),
        },
        create: {
          ...user,
          active: true,
          verified_at: new Date('2025-01-01T00:00:00.000Z'),
        },
      }),
    ),
  );

  await Promise.all(
    users.map((user) =>
      prisma.userPreference.upsert({
        where: { user_id: user.id },
        update: { key: 'theme', value: 'light' },
        create: { user_id: user.id, key: 'theme', value: 'light' },
      }),
    ),
  );

  return {
    admin: users[0],
    editor: users[1],
  };
}

async function seedLookupData() {
  const [categories, tags, partsOfSpeech, language] = await Promise.all([
    Promise.all(
      categoryNames.map((name) =>
        prisma.category.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    ),
    Promise.all(
      tagNames.map((name) =>
        prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    ),
    Promise.all(
      partOfSpeechNames.map((name) =>
        prisma.partOfSpeech.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    ),
    prisma.language.upsert({
      where: { name: 'Ibibio' },
      update: {},
      create: { name: 'Ibibio' },
    }),
  ]);

  await prisma.dialect.upsert({
    where: { name: 'Uyo' },
    update: { language_id: language.id },
    create: { name: 'Uyo', language_id: language.id },
  });

  return {
    categoriesByName: new Map(categories.map((category) => [category.name, category])),
    tagsByName: new Map(tags.map((tag) => [tag.name, tag])),
    partsOfSpeechByName: new Map(
      partsOfSpeech.map((partOfSpeech) => [partOfSpeech.name, partOfSpeech]),
    ),
    language,
  };
}

async function seedArticles(
  adminUserId: string,
  editorUserId: string,
  categoriesByName: Awaited<ReturnType<typeof seedLookupData>>['categoriesByName'],
  tagsByName: Awaited<ReturnType<typeof seedLookupData>>['tagsByName'],
) {
  const articles = [];

  for (const article of seededArticles) {
    const categoryConnections = article.categories.map((name) => ({
      id: categoriesByName.get(name).id,
    }));
    const tagConnections = article.tags.map((name) => ({
      id: tagsByName.get(name).id,
    }));
    const body = `articles/${article.slug}.md`;
    const imagePath = `articles/${article.image.filename}`;
    const fileCreate = {
      id: `seed-image-${article.slug}`,
      originalname: article.image.filename,
      filename: article.image.filename,
      size: article.image.size,
      type: FileType.IMAGE,
      url: article.image.url,
      path: imagePath,
      mimetype: article.image.mimetype,
      caption: article.image.caption,
      credit: article.image.credit,
      alt_text: article.image.altText,
      status: Status.UPLOADED,
      owner: { connect: { id: editorUserId } },
      deleted_at: null,
    };
    const referencesCreate = article.references.map((reference) => ({
      type: ReferenceType.WEBSITE,
      citation: reference.citation,
      url: reference.url,
      authors: ['Nwed Nyin Editorial Team'],
      publisher: 'Nwed Nyin',
      year: 2026,
      access_date: new Date('2026-05-02T00:00:00.000Z'),
    }));
    const versionContent = {
      title: article.title,
      summary: article.summary,
      body,
      markdown: article.markdown,
    };

    const seededArticle = await prisma.article.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        summary: article.summary,
        body,
        created_by: seededUsers[0].email,
        updated_by: seededUsers[1].email,
        version: 1,
        status: Status.PUBLISHED,
        deleted_at: null,
        contributors: { set: [{ id: adminUserId }, { id: editorUserId }] },
        categories: { set: categoryConnections },
        tags: { set: tagConnections },
        sections: {
          deleteMany: {},
          create: article.sections,
        },
        file: {
          deleteMany: {},
          create: fileCreate,
        },
        references: {
          deleteMany: {},
          create: referencesCreate,
        },
        versions: {
          deleteMany: {},
          create: {
            version: 1,
            content: versionContent,
            created_by: seededUsers[0].email,
          },
        },
        metadata: {
          upsert: {
            update: {
              keywords: article.tags,
              language: 'en',
              read_time: article.readTime,
              complexity: article.complexity,
            },
            create: {
              keywords: article.tags,
              language: 'en',
              read_time: article.readTime,
              complexity: article.complexity,
            },
          },
        },
      },
      create: {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        body,
        created_by: seededUsers[0].email,
        updated_by: seededUsers[1].email,
        version: 1,
        status: Status.PUBLISHED,
        deleted_at: null,
        contributors: { connect: [{ id: adminUserId }, { id: editorUserId }] },
        categories: { connect: categoryConnections },
        tags: { connect: tagConnections },
        sections: { create: article.sections },
        file: { create: fileCreate },
        references: { create: referencesCreate },
        versions: {
          create: {
            version: 1,
            content: versionContent,
            created_by: seededUsers[0].email,
          },
        },
        metadata: {
          create: {
            keywords: article.tags,
            language: 'en',
            read_time: article.readTime,
            complexity: article.complexity,
          },
        },
      },
    });

    articles.push(seededArticle);
  }

  const articleBySlug = new Map(articles.map((article) => [article.slug, article]));
  const relatedPairs = [
    [
      'getting-started-with-ibibio-everyday-words',
      ['using-a-dictionary-for-better-writing', 'preserving-words-through-community-contribution'],
    ],
    ['why-oral-history-matters', ['preserving-words-through-community-contribution']],
    ['using-a-dictionary-for-better-writing', ['getting-started-with-ibibio-everyday-words']],
    ['preserving-words-through-community-contribution', ['why-oral-history-matters']],
  ] as const;

  for (const [slug, relatedSlugs] of relatedPairs) {
    const article = articleBySlug.get(slug);
    if (!article) continue;

    await prisma.article.update({
      where: { id: article.id },
      data: {
        related_to: {
          set: relatedSlugs
            .map((relatedSlug) => articleBySlug.get(relatedSlug))
            .filter(Boolean)
            .map((relatedArticle) => ({ id: relatedArticle.id })),
        },
      },
    });
  }

  return articles;
}

async function removeExistingSeedWords() {
  const terms = seededWords.map((word) => word.term);
  const existingWords = await prisma.word.findMany({
    where: { term: { in: terms } },
    select: { id: true },
  });
  const wordIds = existingWords.map((word) => word.id);

  if (!wordIds.length) return;

  const definitions = await prisma.definition.findMany({
    where: { word_id: { in: wordIds } },
    select: { id: true },
  });
  const definitionIds = definitions.map((definition) => definition.id);

  await prisma.wordRelation.deleteMany({
    where: { OR: [{ from_id: { in: wordIds } }, { to_id: { in: wordIds } }] },
  });

  if (definitionIds.length) {
    await Promise.all([
      prisma.example.deleteMany({
        where: { definition_id: { in: definitionIds } },
      }),
      prisma.synonym.deleteMany({
        where: { definition_id: { in: definitionIds } },
      }),
      prisma.antonym.deleteMany({
        where: { definition_id: { in: definitionIds } },
      }),
    ]);
  }

  await prisma.definition.deleteMany({ where: { word_id: { in: wordIds } } });

  for (const word of existingWords) {
    await prisma.word.update({
      where: { id: word.id },
      data: { contributors: { set: [] } },
    });
  }

  await prisma.word.deleteMany({ where: { id: { in: wordIds } } });
}

async function seedDictionary(
  contributorId: string,
  languageId: string,
  partsOfSpeechByName: Awaited<ReturnType<typeof seedLookupData>>['partsOfSpeechByName'],
) {
  await removeExistingSeedWords();

  const createdWords = [];

  for (const word of seededWords) {
    const createdWord = await prisma.word.create({
      data: {
        term: word.term,
        pronunciation: word.pronunciation,
        etymology: word.etymology,
        alt_spelling: word.alt_spelling,
        dialect: word.dialect,
        accent: word.accent,
        deleted_at: null,
        language: { connect: { id: languageId } },
        contributors: { connect: [{ id: contributorId }] },
        definitions: {
          create: word.definitions.map((definition, index) => ({
            meaning: definition.meaning,
            order: index + 1,
            part_of_speech: {
              connect: { id: partsOfSpeechByName.get(definition.partOfSpeech).id },
            },
            examples: {
              create: definition.examples.map((sentence) => ({ sentence })),
            },
            synonyms: {
              create: definition.synonyms.map((synonym) => ({ synonym })),
            },
            antonyms: {
              create: definition.antonyms.map((antonym) => ({ antonym })),
            },
          })),
        },
      },
    });

    createdWords.push(createdWord);
  }

  const wordsByTerm = new Map(createdWords.map((word) => [word.term, word]));

  await Promise.all(
    wordRelations.map(([fromTerm, toTerm, type]) => {
      const fromWord = wordsByTerm.get(fromTerm);
      const toWord = wordsByTerm.get(toTerm);

      if (!fromWord || !toWord) return null;

      return prisma.wordRelation.create({
        data: {
          from_id: fromWord.id,
          to_id: toWord.id,
          type,
        },
      });
    }),
  );

  return createdWords;
}

async function main() {
  console.log('Seeding curated development data...');

  const { admin, editor } = await seedUsers();
  const { categoriesByName, tagsByName, partsOfSpeechByName, language } =
    await seedLookupData();
  const articles = await seedArticles(
    admin.id,
    editor.id,
    categoriesByName,
    tagsByName,
  );
  const words = await seedDictionary(admin.id, language.id, partsOfSpeechByName);

  console.log(
    `Seeded ${articles.length} articles, ${words.length} dictionary entries, and ${seededUsers.length} users.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
