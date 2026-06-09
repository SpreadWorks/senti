<?php

namespace App\Controller;

use App\Entity\Post;
use App\Entity\Thread;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/threads/{threadId}/posts')]
class PostController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route('', name: 'post_store', methods: ['POST'])]
    public function store(Request $request, Thread $thread): Response
    {
        $post = new Post();
        $post->setBody($request->request->getString('body'));
        $post->setUser($this->getUser());
        $post->setThread($thread);
        $post->setPostedAt(new \DateTimeImmutable());

        $this->em->persist($post);
        $this->em->flush();

        return $this->redirectToRoute('thread_show', ['id' => $thread->getId()]);
    }

    #[Route('/{id}/edit', name: 'post_edit', methods: ['GET', 'POST'])]
    public function edit(Request $request, Thread $thread, Post $post): Response
    {
        if ($request->isMethod('POST')) {
            $post->setBody($request->request->getString('body'));
            $this->em->flush();

            return $this->redirectToRoute('thread_show', ['id' => $thread->getId()]);
        }

        return $this->render('post/edit.html.twig', ['thread' => $thread, 'post' => $post]);
    }

    #[Route('/{id}', name: 'post_delete', methods: ['DELETE'])]
    public function delete(Thread $thread, Post $post): Response
    {
        $this->em->remove($post);
        $this->em->flush();

        return $this->redirectToRoute('thread_show', ['id' => $thread->getId()]);
    }
}
