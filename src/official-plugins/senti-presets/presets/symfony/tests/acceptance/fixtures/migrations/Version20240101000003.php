<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20240101000003 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create posts table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE posts (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT NOT NULL,
            thread_id INT NOT NULL,
            body LONGTEXT NOT NULL,
            posted_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            updated_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            INDEX IDX_POSTS_USER (user_id),
            INDEX IDX_POSTS_THREAD (thread_id),
            PRIMARY KEY(id),
            CONSTRAINT FK_POSTS_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            CONSTRAINT FK_POSTS_THREAD FOREIGN KEY (thread_id) REFERENCES threads (id) ON DELETE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE posts');
    }
}
