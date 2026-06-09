<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20240101000004 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create tags and thread_tag tables';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE tags (
            id INT AUTO_INCREMENT NOT NULL,
            name VARCHAR(50) NOT NULL,
            slug VARCHAR(50) NOT NULL,
            UNIQUE INDEX UNIQ_TAGS_NAME (name),
            UNIQUE INDEX UNIQ_TAGS_SLUG (slug),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');

        $this->addSql('CREATE TABLE thread_tag (
            thread_id INT NOT NULL,
            tag_id INT NOT NULL,
            INDEX IDX_THREAD_TAG_THREAD (thread_id),
            INDEX IDX_THREAD_TAG_TAG (tag_id),
            PRIMARY KEY(thread_id, tag_id),
            CONSTRAINT FK_TT_THREAD FOREIGN KEY (thread_id) REFERENCES threads (id) ON DELETE CASCADE,
            CONSTRAINT FK_TT_TAG FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE thread_tag');
        $this->addSql('DROP TABLE tags');
    }
}
