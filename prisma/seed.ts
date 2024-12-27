import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  try {
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        role: 'ADMIN',
        img: faker.image.avatar(),
      },
    });

    const categories = await Promise.all(
      ['Technology', 'Science', 'Business', 'Entertainment', 'Lifestyle'].map(
        (name) => prisma.category.create({ data: { name } }),
      ),
    );
    const tags = await Promise.all(
      [
        'javascript',
        'react',
        'prisma',
        'typescript',
        'webdev',
        'backend',
        'nextjs',
      ].map((name) => prisma.tag.create({ data: { name } })),
    );
    const partsOfSpeech = await Promise.all(
      ['noun', 'verb', 'adjective', 'adverb'].map((name) =>
        prisma.partOfSpeech.create({ data: { name } }),
      ),
    );

    for (let i = 0; i < 10; i++) {
      await prisma.article.create({
        data: {
          title: faker.lorem.sentence(),
          slug: faker.lorem.slug(),
          summary: faker.lorem.paragraph(),
          body: faker.lorem.paragraphs(3),
          contributors: {
            connect: [{ id: user.id }],
          },
          categories: {
            connect: categories
              .map((c) => ({ id: c.id }))
              .slice(0, Math.floor(Math.random() * categories.length)),
          },
          tags: {
            connect: tags
              .map((t) => ({ id: t.id }))
              .slice(0, Math.floor(Math.random() * tags.length)),
          },
          media: {
            create: [
              {
                type: 'image',
                url: faker.image.avatar(),
                caption: faker.lorem.sentence(),
                credit: faker.person.fullName(),
              },
            ],
          },
          references: {
            create: [
              {
                citation: faker.lorem.sentence(),
                url: faker.internet.url(),
                access_date: faker.date.recent(),
              },
            ],
          },
        },
      });
    }

    // Create 50 words
    for (let i = 0; i < 50; i++) {
      await prisma.word.create({
        data: {
          term: faker.word.noun(),
          alt_spelling: faker.word.adjective(),
          etymology: faker.lorem.words(5),
          pronunciation: faker.lorem.word(),
          definitions: {
            create: [
              {
                meaning: faker.lorem.sentence(),
                part_of_speech: {
                  connect: {
                    id: partsOfSpeech[
                      Math.floor(Math.random() * partsOfSpeech.length)
                    ].id,
                  },
                },
              },
            ],
          },
          examples: {
            create: [
              {
                sentence: faker.lorem.sentence(),
              },
            ],
          },
          contributors: {
            connect: [{ id: user.id }],
          },
        },
      });
    }

    // Create synonyms and antonyms for some words
    const words = await prisma.word.findMany();
    for (let i = 0; i < 10; i++) {
      // Create synonyms/antonyms for 10 words
      const word = words[Math.floor(Math.random() * words.length)];
      await prisma.synonym.createMany({
        data: Array(3)
          .fill(null)
          .map(() => ({
            word_id: word.id,
            synonym: faker.word.adjective(), // Use appropriate faker method
          })),
        skipDuplicates: true,
      });
      await prisma.antonym.createMany({
        data: Array(3)
          .fill(null)
          .map(() => ({
            word_id: word.id,
            antonym: faker.word.adjective(), // Use appropriate faker method
          })),
        skipDuplicates: true,
      });
    }

    // Connect related articles
    const articles = await prisma.article.findMany();
    for (let i = 0; i < articles.length; i++) {
      const relatedArticles = articles
        .filter((a) => a.id !== articles[i].id)
        .slice(0, 3); // picking max of 3 random articles to connect with
      await prisma.article.update({
        where: { id: articles[i].id },
        data: {
          related_to: {
            connect: relatedArticles.map((article) => ({ id: article.id })),
          },
        },
      });
    }

    console.log('Seeding complete!');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
