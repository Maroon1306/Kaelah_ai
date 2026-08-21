<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Kaelah_Admin {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_init', array( $this, 'handle_callback' ) );
		add_action( 'admin_post_kaelah_disconnect', array( $this, 'handle_disconnect' ) );
	}

	public function register_menu() {
		add_menu_page(
			__( 'Kaelah AI', 'kaelah-ai-connector' ),
			__( 'Kaelah AI', 'kaelah-ai-connector' ),
			'manage_options',
			'kaelah-ai-connector',
			array( $this, 'render_page' ),
			'dashicons-admin-generic',
			80
		);
	}

	/**
	 * Runs on every admin_init. If Kaelah's consent page just redirected the
	 * browser back here with a one-time authorization code, exchange it
	 * server-to-server for a permanent access token.
	 */
	public function handle_callback() {
		if ( ! isset( $_GET['page'] ) || 'kaelah-ai-connector' !== $_GET['page'] ) {
			return;
		}
		if ( ! isset( $_GET['code'] ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), 'kaelah_connect' ) ) {
			set_transient( 'kaelah_connect_error', __( 'Lien de connexion invalide ou expiré. Merci de réessayer.', 'kaelah-ai-connector' ), 60 );
			wp_safe_redirect( admin_url( 'admin.php?page=kaelah-ai-connector' ) );
			exit;
		}

		$code = sanitize_text_field( wp_unslash( $_GET['code'] ) );

		$response = wp_remote_post(
			trailingslashit( KAELAH_API_URL ) . 'api/connectors/wordpress/oauth/token',
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'code'     => $code,
						'siteUrl'  => home_url(),
						'siteName' => get_bloginfo( 'name' ),
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			set_transient( 'kaelah_connect_error', $response->get_error_message(), 60 );
			wp_safe_redirect( admin_url( 'admin.php?page=kaelah-ai-connector' ) );
			exit;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== wp_remote_retrieve_response_code( $response ) || empty( $body['accessToken'] ) ) {
			$message = isset( $body['error'] ) ? $body['error'] : __( 'La connexion à Kaelah AI a échoué.', 'kaelah-ai-connector' );
			set_transient( 'kaelah_connect_error', $message, 60 );
			wp_safe_redirect( admin_url( 'admin.php?page=kaelah-ai-connector' ) );
			exit;
		}

		update_option( 'kaelah_access_token', sanitize_text_field( $body['accessToken'] ), false );
		update_option( 'kaelah_connected_at', current_time( 'mysql' ), false );

		wp_safe_redirect( admin_url( 'admin.php?page=kaelah-ai-connector&connected=1' ) );
		exit;
	}

	public function handle_disconnect() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Action non autorisée.', 'kaelah-ai-connector' ) );
		}
		check_admin_referer( 'kaelah_disconnect' );

		delete_option( 'kaelah_access_token' );
		delete_option( 'kaelah_connected_at' );

		wp_safe_redirect( admin_url( 'admin.php?page=kaelah-ai-connector&disconnected=1' ) );
		exit;
	}

	/**
	 * The nonce travels inside callback_url itself (not as a sibling param to
	 * Kaelah's consent page) because Kaelah's backend only ever appends
	 * `code` to whatever callback_url it was given — it never inspects or
	 * forwards separate top-level params. Embedding it here is what makes it
	 * survive the round trip back to handle_callback().
	 */
	private function get_connect_url() {
		$callback_url = add_query_arg( '_wpnonce', wp_create_nonce( 'kaelah_connect' ), admin_url( 'admin.php?page=kaelah-ai-connector' ) );

		$params = array(
			'site_url'     => home_url(),
			'site_name'    => get_bloginfo( 'name' ),
			'callback_url' => $callback_url,
		);

		return trailingslashit( KAELAH_APP_URL ) . 'connect/wordpress?' . http_build_query( $params );
	}

	public function render_page() {
		$is_connected = (bool) get_option( 'kaelah_access_token' );
		$connected_at = get_option( 'kaelah_connected_at' );
		$error        = get_transient( 'kaelah_connect_error' );
		if ( $error ) {
			delete_transient( 'kaelah_connect_error' );
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Kaelah AI Connector', 'kaelah-ai-connector' ); ?></h1>

			<?php if ( $error ) : ?>
				<div class="notice notice-error"><p><?php echo esc_html( $error ); ?></p></div>
			<?php endif; ?>

			<?php if ( isset( $_GET['connected'] ) ) : ?>
				<div class="notice notice-success"><p><?php esc_html_e( 'Ce site est maintenant connecté à Kaelah AI.', 'kaelah-ai-connector' ); ?></p></div>
			<?php endif; ?>

			<?php if ( isset( $_GET['disconnected'] ) ) : ?>
				<div class="notice notice-info"><p><?php esc_html_e( 'Ce site a été déconnecté de Kaelah AI.', 'kaelah-ai-connector' ); ?></p></div>
			<?php endif; ?>

			<div class="card" style="max-width:560px;padding:24px;">
				<?php if ( $is_connected ) : ?>
					<p>
						<span class="dashicons dashicons-yes-alt" style="color:#22c55e;"></span>
						<strong><?php esc_html_e( 'Connecté à Kaelah AI', 'kaelah-ai-connector' ); ?></strong>
					</p>
					<?php if ( $connected_at ) : ?>
						<p><?php printf( esc_html__( 'Depuis le %s.', 'kaelah-ai-connector' ), esc_html( $connected_at ) ); ?></p>
					<?php endif; ?>
					<p><?php esc_html_e( 'Kaelah AI peut désormais lire et optimiser le contenu et le SEO de ce site depuis son interface, selon les demandes que tu lui feras.', 'kaelah-ai-connector' ); ?></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="kaelah_disconnect" />
						<?php wp_nonce_field( 'kaelah_disconnect' ); ?>
						<button type="submit" class="button"><?php esc_html_e( 'Déconnecter Kaelah AI', 'kaelah-ai-connector' ); ?></button>
					</form>
				<?php $this->render_status_section(); ?>
				<?php else : ?>
					<p><?php esc_html_e( 'Connecte ce site à ton compte Kaelah AI en un clic — aucune clé API ni mot de passe à saisir.', 'kaelah-ai-connector' ); ?></p>
					<a class="button button-primary button-hero" href="<?php echo esc_url( $this->get_connect_url() ); ?>">
						<?php esc_html_e( 'Connecter à Kaelah AI', 'kaelah-ai-connector' ); ?>
					</a>
				<?php endif; ?>
			</div>
		</div>
		<?php
	}

	/**
	 * Read-only confirmation of what Kaelah AI has actually applied on this
	 * site — SEO/GEO on the homepage, how many pieces of content have SEO/GEO
	 * data, and whether llms.txt is published. All values are read straight
	 * from where the front-end actually renders them (Kaelah_Frontend),
	 * never guessed.
	 */
	private function render_status_section() {
		$homepage_seo_title = get_option( 'kaelah_homepage_seo_title' );
		$homepage_geo_qa    = json_decode( get_option( 'kaelah_homepage_geo_qa', '' ), true );
		$llms_txt           = get_option( 'kaelah_llms_txt' );

		$posts_with_seo = get_posts( array( 'post_type' => array( 'post', 'page' ), 'numberposts' => -1, 'meta_key' => '_kaelah_seo_title', 'fields' => 'ids' ) );
		$posts_with_geo  = get_posts( array( 'post_type' => array( 'post', 'page' ), 'numberposts' => -1, 'meta_key' => '_kaelah_geo_qa', 'fields' => 'ids' ) );
		?>
		<div class="card" style="max-width:560px;padding:24px;margin-top:16px;">
			<h2><?php esc_html_e( 'Ce que Kaelah AI a appliqué sur ce site', 'kaelah-ai-connector' ); ?></h2>
			<table class="widefat" style="margin-top:12px;">
				<tbody>
					<tr>
						<td><?php esc_html_e( 'SEO page d’accueil', 'kaelah-ai-connector' ); ?></td>
						<td><?php echo $homepage_seo_title ? '✅ ' . esc_html( $homepage_seo_title ) : '— ' . esc_html__( 'non défini', 'kaelah-ai-connector' ); ?></td>
					</tr>
					<tr>
						<td><?php esc_html_e( 'GEO page d’accueil (paires question/réponse)', 'kaelah-ai-connector' ); ?></td>
						<td><?php echo ! empty( $homepage_geo_qa ) ? '✅ ' . count( $homepage_geo_qa ) : '— ' . esc_html__( 'non défini', 'kaelah-ai-connector' ); ?></td>
					</tr>
					<tr>
						<td><?php esc_html_e( 'Articles/pages avec SEO Kaelah', 'kaelah-ai-connector' ); ?></td>
						<td><?php echo count( $posts_with_seo ); ?></td>
					</tr>
					<tr>
						<td><?php esc_html_e( 'Articles/pages avec GEO Kaelah', 'kaelah-ai-connector' ); ?></td>
						<td><?php echo count( $posts_with_geo ); ?></td>
					</tr>
					<tr>
						<td>llms.txt</td>
						<td>
							<?php if ( $llms_txt ) : ?>
								✅ <a href="<?php echo esc_url( home_url( '/llms.txt' ) ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( home_url( '/llms.txt' ) ); ?></a>
							<?php else : ?>
								— <?php esc_html_e( 'non publié', 'kaelah-ai-connector' ); ?>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<td>robots.txt</td>
						<td><a href="<?php echo esc_url( home_url( '/robots.txt' ) ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Voir', 'kaelah-ai-connector' ); ?></a></td>
					</tr>
				</tbody>
			</table>
			<p style="margin-top:12px;"><em><?php esc_html_e( 'Astuce : clique droit sur une page du site → "Afficher le code source" pour voir le titre SEO, la meta description et les données structurées (JSON-LD) réellement injectés.', 'kaelah-ai-connector' ); ?></em></p>
		</div>
		<?php
	}
}
