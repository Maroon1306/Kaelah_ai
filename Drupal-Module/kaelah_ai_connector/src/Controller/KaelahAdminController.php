<?php

namespace Drupal\kaelah_ai_connector\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Render\Markup;
use Drupal\Core\Url;
use GuzzleHttp\ClientInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Renders the connect/disconnect settings page and handles the OAuth
 * callback redirect coming back from Kaelah AI's consent screen.
 */
class KaelahAdminController extends ControllerBase {

  protected ClientInterface $httpClient;

  public function __construct(ClientInterface $http_client) {
    $this->httpClient = $http_client;
  }

  public static function create(ContainerInterface $container) {
    return new static($container->get('http_client'));
  }

  public function settingsPage(Request $request) {
    $code = $request->query->get('code');
    if ($code) {
      $error = $this->exchangeCode($code);
      if ($error === NULL) {
        return $this->redirect('kaelah_ai_connector.settings', [], ['query' => ['connected' => 1]]);
      }
      $this->messenger()->addError($error);
      return $this->redirect('kaelah_ai_connector.settings');
    }

    $state = \Drupal::state();
    $token = $state->get('kaelah_ai_connector.access_token');
    $connected_at = $state->get('kaelah_ai_connector.connected_at');

    $build = [];

    if ($request->query->get('connected')) {
      $build['success'] = [
        '#markup' => '<div class="messages messages--status">' . $this->t('Ce site est maintenant connecté à Kaelah AI.') . '</div>',
      ];
    }

    if ($token) {
      $build['status'] = [
        '#markup' => '<p><strong>' . $this->t('Connecté à Kaelah AI') . '</strong></p>'
          . ($connected_at ? '<p>' . $this->t('Depuis le @date.', ['@date' => $connected_at]) . '</p>' : ''),
      ];
      $build['description'] = [
        '#markup' => '<p>' . $this->t('Kaelah AI peut désormais lire et optimiser le contenu et le SEO de ce site depuis son interface.') . '</p>',
      ];
      $build['disconnect'] = [
        '#type' => 'link',
        '#title' => $this->t('Déconnecter Kaelah AI'),
        '#url' => Url::fromRoute('kaelah_ai_connector.disconnect'),
        '#attributes' => ['class' => ['button', 'button--danger']],
      ];
      $build['kaelah_status_table'] = $this->buildStatusSection();
    }
    else {
      $params = [
        'site_url' => $this->getSiteBaseUrl($request),
        'site_name' => $this->config('system.site')->get('name'),
        'callback_url' => Url::fromRoute('kaelah_ai_connector.settings', [], ['absolute' => TRUE])->toString(),
      ];
      $connect_url = rtrim(KAELAH_APP_URL, '/') . '/connect/drupal?' . http_build_query($params);

      $build['intro'] = [
        '#markup' => '<p>' . $this->t('Connecte ce site à ton compte Kaelah AI en un clic — aucune clé API ni mot de passe à saisir.') . '</p>',
      ];
      $build['connect'] = [
        '#type' => 'link',
        '#title' => $this->t('Connecter à Kaelah AI'),
        '#url' => Url::fromUri($connect_url),
        '#attributes' => ['class' => ['button', 'button--primary']],
      ];
    }

    return $build;
  }

  /**
   * Exchanges the one-time authorization code for a permanent access token.
   *
   * @return string|null
   *   NULL on success, or a translated error message.
   */
  private function exchangeCode(string $code): ?string {
    try {
      $response = $this->httpClient->post(rtrim(KAELAH_API_URL, '/') . '/api/connectors/drupal/oauth/token', [
        'json' => [
          'code' => $code,
          'siteUrl' => $this->getSiteBaseUrl(\Drupal::request()),
          'siteName' => $this->config('system.site')->get('name'),
        ],
        'timeout' => 15,
        'http_errors' => FALSE,
      ]);
      $body = json_decode((string) $response->getBody(), TRUE);
    }
    catch (\Exception $e) {
      return (string) $this->t('La connexion à Kaelah AI a échoué : @message', ['@message' => $e->getMessage()]);
    }

    if (empty($body['accessToken'])) {
      $message = $body['error'] ?? NULL;
      return $message ? (string) $message : (string) $this->t('La connexion à Kaelah AI a échoué.');
    }

    $state = \Drupal::state();
    $state->set('kaelah_ai_connector.access_token', $body['accessToken']);
    $state->set('kaelah_ai_connector.connected_at', date('Y-m-d H:i:s'));

    return NULL;
  }

  /**
   * Read-only confirmation of what Kaelah AI has actually applied on this
   * site — SEO/GEO on the homepage, how many recent nodes have SEO/GEO data,
   * and whether llms.txt is published. Values are read straight from where
   * kaelah_ai_connector_page_attachments()/preprocess_html() actually render
   * them, never guessed.
   */
  private function buildStatusSection(): array {
    $state = \Drupal::state();
    $homepage_seo_title = $state->get('kaelah_ai_connector.homepage_seo_title');
    $homepage_geo_qa = $state->get('kaelah_ai_connector.homepage_geo_qa', []);
    $llms_txt = $state->get('kaelah_ai_connector.llms_txt');

    $nids = \Drupal::entityQuery('node')->accessCheck(FALSE)->condition('status', 1)->range(0, 50)->execute();
    $seo_count = 0;
    $geo_count = 0;
    foreach ($nids as $nid) {
      if ($state->get('kaelah_ai_connector.seo_title.' . $nid)) {
        $seo_count++;
      }
      if (!empty($state->get('kaelah_ai_connector.geo_qa.' . $nid, []))) {
        $geo_count++;
      }
    }

    $llms_txt_url = Url::fromRoute('kaelah_ai_connector.llms_txt_serve', [], ['absolute' => TRUE])->toString();
    $robots_txt_url = $this->getSiteBaseUrl(\Drupal::request()) . '/robots.txt';

    $rows = [
      [$this->t('SEO page d’accueil'), $homepage_seo_title ? '✅ ' . $homepage_seo_title : '— ' . $this->t('non défini')],
      [$this->t('GEO page d’accueil (paires question/réponse)'), !empty($homepage_geo_qa) ? '✅ ' . count($homepage_geo_qa) : '— ' . $this->t('non défini')],
      [$this->t('Contenus (50 derniers) avec SEO Kaelah'), $seo_count],
      [$this->t('Contenus (50 derniers) avec GEO Kaelah'), $geo_count],
      ['llms.txt', $llms_txt ? Markup::create('✅ <a href="' . $llms_txt_url . '" target="_blank" rel="noopener noreferrer">' . $llms_txt_url . '</a>') : '— ' . $this->t('non publié')],
      ['robots.txt', Markup::create('<a href="' . $robots_txt_url . '" target="_blank" rel="noopener noreferrer">' . $this->t('Voir') . '</a>')],
    ];

    return [
      '#type' => 'table',
      '#header' => [$this->t('Élément'), $this->t('Statut')],
      '#rows' => $rows,
      '#prefix' => '<h2>' . $this->t('Ce que Kaelah AI a appliqué sur ce site') . '</h2>',
      '#suffix' => '<p><em>' . $this->t('Astuce : clic droit sur une page du site → "Afficher le code source" pour voir le titre SEO, la meta description et les données structurées (JSON-LD) réellement injectés.') . '</em></p>',
    ];
  }

  /**
   * Full site base URL including any subdirectory the site is installed in
   * (e.g. "http://localhost/Drupal"), unlike Request::getSchemeAndHttpHost()
   * which only returns the scheme and host.
   */
  private function getSiteBaseUrl($request): string {
    return rtrim($request->getSchemeAndHttpHost() . base_path(), '/');
  }

}
