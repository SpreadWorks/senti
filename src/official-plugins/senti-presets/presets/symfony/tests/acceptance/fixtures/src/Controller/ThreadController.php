<?php

namespace App\Controller;

use App\Entity\Thread;
use App\Repository\ThreadRepository;
use App\Repository\TagRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/threads')]
class ThreadController extends AbstractController
{
    public function __construct(
        private readonly ThreadRepository $threadRepository,
        private readonly TagRepository $tagRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route('', name: 'thread_index', methods: ['GET'])]
    public function index(): Response
    {
        $threads = $this->threadRepository->findBy([], ['createdAt' => 'DESC']);
        return $this->render('thread/index.html.twig', ['threads' => $threads]);
    }

    #[Route('/new', name: 'thread_new', methods: ['GET', 'POST'])]
    public function new(Request $request): Response
    {
        if ($request->isMethod('POST')) {
            $thread = new Thread();
            $thread->setTitle($request->request->getString('title'));
            $thread->setBody($request->request->getString('body'));
            $thread->setUser($this->getUser());

            foreach ($request->request->all('tags') as $tagId) {
                $tag = $this->tagRepository->find($tagId);
                if ($tag) {
                    $thread->addTag($tag);
                }
            }

            $this->em->persist($thread);
            $this->em->flush();

            return $this->redirectToRoute('thread_show', ['id' => $thread->getId()]);
        }

        $tags = $this->tagRepository->findAll();
        return $this->render('thread/new.html.twig', ['tags' => $tags]);
    }

    #[Route('/{id}', name: 'thread_show', methods: ['GET'])]
    public function show(Thread $thread): Response
    {
        return $this->render('thread/show.html.twig', ['thread' => $thread]);
    }

    #[Route('/{id}/edit', name: 'thread_edit', methods: ['GET', 'POST'])]
    public function edit(Request $request, Thread $thread): Response
    {
        if ($request->isMethod('POST')) {
            $thread->setTitle($request->request->getString('title'));
            $thread->setBody($request->request->getString('body'));
            $thread->setStatus($request->request->getString('status'));
            $this->em->flush();

            return $this->redirectToRoute('thread_show', ['id' => $thread->getId()]);
        }

        return $this->render('thread/edit.html.twig', ['thread' => $thread]);
    }

    #[Route('/{id}', name: 'thread_delete', methods: ['DELETE'])]
    public function delete(Thread $thread): Response
    {
        $this->em->remove($thread);
        $this->em->flush();

        return $this->redirectToRoute('thread_index');
    }
}
