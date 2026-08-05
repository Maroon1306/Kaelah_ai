<?php

namespace Drupal\kaelah_ai_connector\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Url;
use Drupal\node\Entity\Node;
use Drupal\node\NodeInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Thin, generic REST gateway used by Kaelah AI to read and update content on
 * this site. No SEO/GEO/AI logic lives here — Kaelah's own servers decide
 * what to fetch and what to write; this class only exposes authenticated
 * access to Drupal's own data.
 */
class KaelahApiController extends ControllerBase {

  /**
   * Validates the Authorization: Bearer <token> header against the token
   * issued during the OAuth handshake with Kaelah AI.
   */
  private function checkToken(Request $request): ?JsonResponse {
    $stored = \Drupal::state()->get('kaelah_ai_connector.access_token');
    if (empty($stored)) {
      return new JsonResponse(['error' => 'not_connected', 'message' => "Ce site n'est pas connecté à Kaelah AI."], 401);
    }

    $auth = $request->headers->get('Authorization', '');
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $matches)) {
      return new JsonResponse(['error' => 'missing_token', 'message' => "Jeton d'authentification manquant."], 401);
    }

    if (!hash_equals($stored, $matches[1])) {
      return new JsonResponse(['error' => 'invalid_token', 'message' => "Jeton d'authentification invalide."], 403);
    }

    return NULL;
  }

  public function siteInfo(Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }
    return new JsonResponse([
      'name' => $this->config('system.site')->get('name'),
      'url' => rtrim($request->getSchemeAndHttpHost() . base_path(), '/'),
    ]);
  }

  private function formatNode(NodeInterface $node): array {
    $state = \Drupal::state();
    return [
      'id' => (int) $node->id(),
      'title' => $node->getTitle(),
      'status' => $node->isPublished() ? 'publish' : 'draft',
      'link' => $node->toUrl('canonical', ['absolute' => TRUE])->toString(),
      'seoTitle' => (string) $state->get('kaelah_ai_connector.seo_title.' . $node->id(), ''),
      'seoDescription' => (string) $state->get('kaelah_ai_connector.seo_description.' . $node->id(), ''),
    ];
  }

  public function contentList(Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }

    $limit = min(50, max(1, (int) $request->query->get('limit', 10)));
    $nids = \Drupal::entityQuery('node')
      ->accessCheck(FALSE)
      ->condition('status', 1)
      ->sort('changed', 'DESC')
      ->range(0, $limit)
      ->execute();

    $nodes = Node::loadMultiple($nids);
    return new JsonResponse(array_values(array_map([$this, 'formatNode'], $nodes)));
  }

  public function updateContent(NodeInterface $node, Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }

    $data = json_decode($request->getContent(), TRUE) ?? [];
    if (!empty($data['title'])) {
      $node->setTitle($data['title']);
    }
    if (isset($data['body']) && $node->hasField('body')) {
      $node->set('body', ['value' => $data['body'], 'format' => 'basic_html']);
    }
    $node->save();

    return new JsonResponse($this->formatNode($node));
  }

  public function updateSeo(NodeInterface $node, Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }

    $data = json_decode($request->getContent(), TRUE) ?? [];
    $state = \Drupal::state();

    if (isset($data['seoTitle'])) {
      $state->set('kaelah_ai_connector.seo_title.' . $node->id(), $data['seoTitle']);
    }
    if (isset($data['seoDescription'])) {
      $state->set('kaelah_ai_connector.seo_description.' . $node->id(), $data['seoDescription']);
    }

    return new JsonResponse($this->formatNode($node));
  }

  public function updateHomepageSeo(Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }

    $data = json_decode($request->getContent(), TRUE) ?? [];
    $state = \Drupal::state();

    if (isset($data['seoTitle'])) {
      $state->set('kaelah_ai_connector.homepage_seo_title', $data['seoTitle']);
    }
    if (isset($data['seoDescription'])) {
      $state->set('kaelah_ai_connector.homepage_seo_description', $data['seoDescription']);
    }

    return new JsonResponse([
      'seoTitle' => $state->get('kaelah_ai_connector.homepage_seo_title', ''),
      'seoDescription' => $state->get('kaelah_ai_connector.homepage_seo_description', ''),
    ]);
  }

  /**
   * Stores GEO (Generative Engine Optimization) content — conversational
   * summary, Q&A pairs, structured data note — via the State API. Actual
   * FAQPage JSON-LD rendering happens in kaelah_ai_connector_page_attachments().
   */
  public function updateGeo(NodeInterface $node, Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }

    $data = json_decode($request->getContent(), TRUE) ?? [];
    $state = \Drupal::state();

    if (isset($data['conversationalSummary'])) {
      $state->set('kaelah_ai_connector.geo_summary.' . $node->id(), $data['conversationalSummary']);
    }
    if (isset($data['qaPairs']) && is_array($data['qaPairs'])) {
      $clean = [];
      foreach ($data['qaPairs'] as $pair) {
        if (!empty($pair['question']) && !empty($pair['answer'])) {
          $clean[] = ['question' => $pair['question'], 'answer' => $pair['answer']];
        }
      }
      $state->set('kaelah_ai_connector.geo_qa.' . $node->id(), $clean);
    }
    if (isset($data['structuredDataSuggestion'])) {
      $state->set('kaelah_ai_connector.geo_structured_note.' . $node->id(), $data['structuredDataSuggestion']);
    }

    return new JsonResponse([
      'id' => (int) $node->id(),
      'conversationalSummary' => $state->get('kaelah_ai_connector.geo_summary.' . $node->id(), ''),
      'qaPairs' => $state->get('kaelah_ai_connector.geo_qa.' . $node->id(), []),
    ]);
  }

  public function updateHomepageGeo(Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }

    $data = json_decode($request->getContent(), TRUE) ?? [];
    $state = \Drupal::state();

    if (isset($data['conversationalSummary'])) {
      $state->set('kaelah_ai_connector.homepage_geo_summary', $data['conversationalSummary']);
    }
    if (isset($data['qaPairs']) && is_array($data['qaPairs'])) {
      $clean = [];
      foreach ($data['qaPairs'] as $pair) {
        if (!empty($pair['question']) && !empty($pair['answer'])) {
          $clean[] = ['question' => $pair['question'], 'answer' => $pair['answer']];
        }
      }
      $state->set('kaelah_ai_connector.homepage_geo_qa', $clean);
    }
    if (isset($data['structuredDataSuggestion'])) {
      $state->set('kaelah_ai_connector.homepage_geo_structured_note', $data['structuredDataSuggestion']);
    }

    return new JsonResponse([
      'conversationalSummary' => $state->get('kaelah_ai_connector.homepage_geo_summary', ''),
      'qaPairs' => $state->get('kaelah_ai_connector.homepage_geo_qa', []),
    ]);
  }

  public function getLlmsTxt(Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }
    return new JsonResponse(['content' => \Drupal::state()->get('kaelah_ai_connector.llms_txt', '')]);
  }

  /**
   * Stores the markdown Kaelah AI has generated, served live at /llms.txt
   * by serveLlmsTxt() — a curated summary of the site written for LLMs.
   */
  public function updateLlmsTxt(Request $request) {
    if ($error = $this->checkToken($request)) {
      return $error;
    }
    $data = json_decode($request->getContent(), TRUE) ?? [];
    if (!isset($data['content'])) {
      return new JsonResponse(['error' => 'missing_content', 'message' => 'Contenu manquant.'], 400);
    }
    \Drupal::state()->set('kaelah_ai_connector.llms_txt', $data['content']);
    return new JsonResponse([
      'content' => \Drupal::state()->get('kaelah_ai_connector.llms_txt', ''),
      'url' => Url::fromRoute('kaelah_ai_connector.llms_txt_serve', [], ['absolute' => TRUE])->toString(),
    ]);
  }

  public function serveLlmsTxt() {
    $content = \Drupal::state()->get('kaelah_ai_connector.llms_txt', '');
    if (empty($content)) {
      throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException();
    }
    return new Response($content, 200, ['Content-Type' => 'text/plain; charset=utf-8']);
  }

}
