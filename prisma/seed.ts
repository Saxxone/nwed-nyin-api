import { PrismaClient, MediaType, Role, Status, ReferenceType, RelationType } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  try {
    // Create initial admin user
    const adminUser = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        role: Role.ADMIN,
        img: faker.image.avatar(),
        active: true,
        last_login: faker.date.recent(),
        preferences: {
          theme: 'dark',
          notifications: true,
        },
        verified_at: faker.date.past(),
      },
    });

    // Create editor user
    const editorUser = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        role: Role.EDITOR,
        img: faker.image.avatar(),
        active: true,
        verified_at: faker.date.past(),
      },
    });

    // Create categories
    const categories = await Promise.all(
      ['Technology', 'Science', 'Business', 'Entertainment', 'Lifestyle'].map(
        (name) => prisma.category.create({ data: { name } })
      )
    );

    // Create tags
    const tags = await Promise.all(
      [
        'javascript',
        'react',
        'prisma',
        'typescript',
        'webdev',
        'backend',
        'nextjs',
      ].map((name) => prisma.tag.create({ data: { name } }))
    );

    // Create parts of speech
    const partsOfSpeech = await Promise.all(
      ['noun', 'verb', 'adjective', 'adverb'].map((name) =>
        prisma.partOfSpeech.create({ data: { name } })
      )
    );

    // Create articles with all related data
    const articles = await Promise.all(
      Array(10).fill(null).map(async () => {
        const title = faker.lorem.sentence();
        const created_by = adminUser.id;
        const updated_by = editorUser.id;

        return prisma.article.create({
          data: {
            title,
            slug: faker.helpers.slugify(title.toLowerCase()),
            summary: faker.lorem.paragraph(),
            body: faker.lorem.paragraphs(3),
            created_by,
            updated_by,
            status: faker.helpers.arrayElement(Object.values(Status)),
            sections: {
              create: Array(3).fill(null).map(() => ({
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraphs(2),
              })),
            },
            contributors: {
              connect: [{ id: adminUser.id }, { id: editorUser.id }],
            },
            categories: {
              connect: faker.helpers.arrayElements(
                categories.map((c) => ({ id: c.id })),
                { min: 1, max: categories.length }
              ),
            },
            tags: {
              connect: faker.helpers.arrayElements(
                tags.map((t) => ({ id: t.id })),
                { min: 1, max: tags.length }
              ),
            },
            media: {
              create: [{
                type: MediaType.IMAGE,
                url: faker.image.url(),
                caption: faker.lorem.sentence(),
                credit: faker.person.fullName(),
                alt_text: faker.lorem.sentence(),
                mime_type: 'image/jpeg',
                size: faker.number.int({ min: 50000, max: 5000000 }),
                dimensions: { width: 1920, height: 1080 },
              }],
            },
            references: {
              create: [{
                type: faker.helpers.arrayElement(Object.values(ReferenceType)),
                citation: faker.lorem.sentence(),
                url: faker.internet.url(),
                doi: faker.string.alphanumeric(10),
                isbn: faker.string.numeric(13),
                authors: JSON.stringify([faker.person.fullName(), faker.person.fullName()]),
                publisher: faker.company.name(),
                year: faker.date.past().getFullYear(),
                access_date: faker.date.recent(),
              }],
            },
            metadata: {
              create: {
                keywords: Array(5).fill(null).map(() => faker.word.sample()),
                language: 'en',
                read_time: faker.number.int({ min: 3, max: 20 }),
                complexity: faker.helpers.arrayElement(['beginner', 'intermediate', 'advanced']),
              },
            },
            versions: {
              create: {
                version: 1,
                created_by,
                content: {
                  title,
                  body: faker.lorem.paragraphs(3),
                  summary: faker.lorem.paragraph(),
                },
              },
            },
          },
        });
      })
    );

    // Create words with enhanced relationships
    const words = await Promise.all(
      Array(50).fill(null).map(async () => {
        const term = faker.word.sample();
        
        return prisma.word.create({
          data: {
            term,
            pronunciation: faker.word.sample(),
            etymology: faker.lorem.paragraph(),
            alt_spelling: faker.word.sample(),
            contributors: {
              connect: [{ id: adminUser.id }],
            },
            definitions: {
              create: Array(faker.number.int({ min: 1, max: 3 }))
                .fill(null)
                .map((_, index) => ({
                  meaning: faker.lorem.sentence(),
                  order: index + 1,
                  part_of_speech: {
                    connect: {
                      id: faker.helpers.arrayElement(partsOfSpeech).id,
                    },
                  },
                  examples: {
                    create: Array(faker.number.int({ min: 1, max: 3 }))
                      .fill(null)
                      .map(() => ({
                        sentence: faker.lorem.sentence(),
                      })),
                  },
                  synonyms: {
                    create: Array(3).fill(null).map(() => ({
                      synonym: faker.word.sample(),
                    })),
                  },
                  antonyms: {
                    create: Array(3).fill(null).map(() => ({
                      antonym: faker.word.sample(),
                    })),
                  },
                })),
            },
          },
        });
      })
    );

    // Create word relationships
    await Promise.all(
      words.map(async (word) => {
        const relatedWords = faker.helpers.arrayElements(
          words.filter(w => w.id !== word.id),
          { min: 1, max: 3 }
        );

        await Promise.all(
          relatedWords.map(async (relatedWord) => {
            return prisma.wordRelation.create({
              data: {
                from_id: word.id,
                to_id: relatedWord.id,
                type: faker.helpers.arrayElement(Object.values(RelationType)),
              },
            });
          })
        );
      })
    );

    // Connect related articles
    await Promise.all(
      articles.map(async (article) => {
        const relatedArticles = faker.helpers.arrayElements(
          articles.filter((a) => a.id !== article.id),
          { min: 1, max: 3 }
        );
        
        await prisma.article.update({
          where: { id: article.id },
          data: {
            related_to: {
              connect: relatedArticles.map((related) => ({ id: related.id })),
            },
          },
        });
      })
    );

    console.log('Seeding complete!');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });