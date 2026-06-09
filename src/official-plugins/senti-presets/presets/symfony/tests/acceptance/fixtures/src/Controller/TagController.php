<?php

namespace App\Controller;

use App\Entity\Tag;
use App\Repository\TagRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/tags')]
class TagController extends AbstractController
{
    public function __construct(
        private readonly TagRepository $tagRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route('', name: 'tag_index', methods: ['GET'])]
    public function index(): JsonResponse
    {
        $tags = $this->tagRepository->findAll();
        return $this->json($tags);
    }

    #[Route('', name: 'tag_store', methods: ['POST'])]
    public function store(Request $request): JsonResponse
    {
        $tag = new Tag();
        $tag->setName($request->getPayload()->getString('name'));
        $tag->setSlug($request->getPayload()->getString('slug'));

        $this->em->persist($tag);
        $this->em->flush();

        return $this->json($tag, 201);
    }

    #[Route('/{id}', name: 'tag_show', methods: ['GET'])]
    public function show(Tag $tag): JsonResponse
    {
        return $this->json($tag);
    }

    #[Route('/{id}', name: 'tag_update', methods: ['PUT'])]
    public function update(Request $request, Tag $tag): JsonResponse
    {
        $tag->setName($request->getPayload()->getString('name'));
        $tag->setSlug($request->getPayload()->getString('slug'));
        $this->em->flush();

        return $this->json($tag);
    }

    #[Route('/{id}', name: 'tag_delete', methods: ['DELETE'])]
    public function delete(Tag $tag): JsonResponse
    {
        $this->em->remove($tag);
        $this->em->flush();

        return $this->json(null, 204);
    }
}
