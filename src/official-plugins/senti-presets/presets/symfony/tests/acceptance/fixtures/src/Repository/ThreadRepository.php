<?php

namespace App\Repository;

use App\Entity\Thread;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Thread>
 */
class ThreadRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Thread::class);
    }

    /**
     * @return Thread[]
     */
    public function findRecentOpen(int $limit = 20): array
    {
        return $this->createQueryBuilder('t')
            ->where('t.status = :status')
            ->setParameter('status', 'open')
            ->orderBy('t.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }
}
