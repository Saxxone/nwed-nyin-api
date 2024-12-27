-- CreateTable
CREATE TABLE "_word_contributors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_word_contributors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_word_contributors_B_index" ON "_word_contributors"("B");

-- AddForeignKey
ALTER TABLE "_word_contributors" ADD CONSTRAINT "_word_contributors_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_word_contributors" ADD CONSTRAINT "_word_contributors_B_fkey" FOREIGN KEY ("B") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
