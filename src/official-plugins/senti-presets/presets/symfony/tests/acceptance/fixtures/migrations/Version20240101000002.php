<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20240101000002 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create threads table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE threads (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            body LONGTEXT NOT NULL,
            status VARCHAR(20) DEFAULT \'open\' NOT NULL,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            updated_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            INDEX IDX_THREADS_USER (user_id),
            PRIMARY KEY(id),
            CONSTRAINT FK_THREADS_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE threads');
    }
}
