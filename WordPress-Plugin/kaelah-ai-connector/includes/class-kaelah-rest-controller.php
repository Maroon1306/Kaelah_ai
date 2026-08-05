<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Thin, generic REST gateway used by Kaelah AI to read and update content on
 * this site. No SEO/GEO/AI logic lives here — Kaelah's own servers decide
 * what to fetch and what to write; this class only exposes authenticated
 * access to WordPress's own data.
 */
class Kaelah_Rest_Controller {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes() {
		register_rest_route(
			'kaelah/v1',
			'/site-info',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_site_info' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/posts',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_posts' ),
					'permission_callback' => array( $this, 'check_token' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'create_post' ),
					'permission_callback' => array( $this, 'check_token' ),
				),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/pages',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_pages' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/content/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_content' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/seo/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_seo' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/seo/homepage',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_homepage_seo' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/geo/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_geo' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/geo/homepage',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_homepage_geo' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/llms-txt',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_llms_txt' ),
					'permission_callback' => array( $this, 'check_token' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'update_llms_txt' ),
					'permission_callback' => array( $this, 'check_token' ),
				),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/robots-txt',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_robots_txt' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/woocommerce/products',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_woocommerce_products' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/woocommerce/orders-summary',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_woocommerce_orders_summary' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/media',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_media' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/categories',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_categories' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/categories/(?P<id>\d+)/seo',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_category_seo' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);

		register_rest_route(
			'kaelah/v1',
			'/media/(?P<id>\d+)/alt',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_media_alt' ),
				'permission_callback' => array( $this, 'check_token' ),
			)
		);
	}

	/**
	 * Validates the Authorization: Bearer <token> header against the token
	 * issued during the OAuth handshake with Kaelah AI.
	 */
	public function check_token( $request ) {
		$stored_token = get_option( 'kaelah_access_token' );
		if ( empty( $stored_token ) ) {
			return new WP_Error( 'kaelah_not_connected', __( 'Ce site n\'est pas connecté à Kaelah AI.', 'kaelah-ai-connector' ), array( 'status' => 401 ) );
		}

		$auth_header = $request->get_header( 'authorization' );
		if ( empty( $auth_header ) || ! preg_match( '/^Bearer\s+(.+)$/i', $auth_header, $matches ) ) {
			return new WP_Error( 'kaelah_missing_token', __( 'Jeton d\'authentification manquant.', 'kaelah-ai-connector' ), array( 'status' => 401 ) );
		}

		if ( ! hash_equals( $stored_token, $matches[1] ) ) {
			return new WP_Error( 'kaelah_invalid_token', __( 'Jeton d\'authentification invalide.', 'kaelah-ai-connector' ), array( 'status' => 403 ) );
		}

		return true;
	}

	public function get_site_info() {
		return array(
			'name' => get_bloginfo( 'name' ),
			'url'  => home_url(),
		);
	}

	private function format_post( $post ) {
		return array(
			'id'             => $post->ID,
			'title'          => get_the_title( $post ),
			'status'         => $post->post_status,
			'link'           => get_permalink( $post ),
			'seoTitle'       => get_post_meta( $post->ID, '_kaelah_seo_title', true ),
			'seoDescription' => get_post_meta( $post->ID, '_kaelah_seo_description', true ),
		);
	}

	public function get_posts( $request ) {
		$limit = min( 50, max( 1, (int) $request->get_param( 'limit' ) ?: 10 ) );
		$posts = get_posts(
			array(
				'post_type'      => 'post',
				'post_status'    => 'publish',
				'numberposts'    => $limit,
			)
		);
		return array_map( array( $this, 'format_post' ), $posts );
	}

	public function get_pages( $request ) {
		$limit = min( 50, max( 1, (int) $request->get_param( 'limit' ) ?: 10 ) );
		$pages = get_posts(
			array(
				'post_type'   => 'page',
				'post_status' => 'publish',
				'numberposts' => $limit,
			)
		);
		return array_map( array( $this, 'format_post' ), $pages );
	}

	public function update_content( $request ) {
		$id = (int) $request->get_param( 'id' );
		if ( ! get_post( $id ) ) {
			return new WP_Error( 'kaelah_not_found', __( 'Contenu introuvable.', 'kaelah-ai-connector' ), array( 'status' => 404 ) );
		}

		$update = array( 'ID' => $id );
		$title  = $request->get_param( 'title' );
		$content = $request->get_param( 'content' );
		if ( null !== $title ) {
			$update['post_title'] = sanitize_text_field( $title );
		}
		if ( null !== $content ) {
			$update['post_content'] = wp_kses_post( $content );
		}

		$result = wp_update_post( $update, true );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->format_post( get_post( $id ) );
	}

	/**
	 * Creates a real new post — used by bulk SEO-article-generation flows.
	 * Optional seoTitle/seoDescription are stored via the same meta keys
	 * update_seo() uses, so the new post is fully optimized from creation.
	 */
	public function create_post( $request ) {
		$title   = $request->get_param( 'title' );
		$content = $request->get_param( 'content' );
		if ( empty( $title ) ) {
			return new WP_Error( 'kaelah_missing_title', __( 'Titre manquant.', 'kaelah-ai-connector' ), array( 'status' => 400 ) );
		}

		$post_id = wp_insert_post(
			array(
				'post_type'    => 'post',
				'post_status'  => 'publish',
				'post_title'   => sanitize_text_field( $title ),
				'post_content' => $content ? wp_kses_post( $content ) : '',
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		$seo_title       = $request->get_param( 'seoTitle' );
		$seo_description = $request->get_param( 'seoDescription' );
		if ( $seo_title ) {
			update_post_meta( $post_id, '_kaelah_seo_title', sanitize_text_field( $seo_title ) );
		}
		if ( $seo_description ) {
			update_post_meta( $post_id, '_kaelah_seo_description', sanitize_text_field( $seo_description ) );
		}

		return $this->format_post( get_post( $post_id ) );
	}

	/**
	 * Stores SEO overrides under this plugin's own meta keys (always rendered
	 * by kaelah_ai_connector_wp_head(), regardless of whether a third-party
	 * SEO plugin is installed) and mirrors them into Yoast SEO's keys too if
	 * Yoast is active, so it stays the source of truth when present.
	 */
	public function update_seo( $request ) {
		$id = (int) $request->get_param( 'id' );
		if ( ! get_post( $id ) ) {
			return new WP_Error( 'kaelah_not_found', __( 'Contenu introuvable.', 'kaelah-ai-connector' ), array( 'status' => 404 ) );
		}

		$seo_title       = $request->get_param( 'seoTitle' );
		$seo_description = $request->get_param( 'seoDescription' );

		if ( null !== $seo_title ) {
			$seo_title = sanitize_text_field( $seo_title );
			update_post_meta( $id, '_kaelah_seo_title', $seo_title );
			if ( defined( 'WPSEO_VERSION' ) ) {
				update_post_meta( $id, '_yoast_wpseo_title', $seo_title );
			}
			if ( defined( 'RANK_MATH_VERSION' ) ) {
				update_post_meta( $id, 'rank_math_title', $seo_title );
			}
		}
		if ( null !== $seo_description ) {
			$seo_description = sanitize_text_field( $seo_description );
			update_post_meta( $id, '_kaelah_seo_description', $seo_description );
			if ( defined( 'WPSEO_VERSION' ) ) {
				update_post_meta( $id, '_yoast_wpseo_metadesc', $seo_description );
			}
			if ( defined( 'RANK_MATH_VERSION' ) ) {
				update_post_meta( $id, 'rank_math_description', $seo_description );
			}
		}

		return $this->format_post( get_post( $id ) );
	}

	/**
	 * Stores GEO (Generative Engine Optimization) content — conversational
	 * summary, Q&A pairs, structured data — as post meta. Actual rendering
	 * as a JSON-LD <script> tag happens in Kaelah_Frontend, on the real
	 * front-end page.
	 */
	public function update_geo( $request ) {
		$id = (int) $request->get_param( 'id' );
		if ( ! get_post( $id ) ) {
			return new WP_Error( 'kaelah_not_found', __( 'Contenu introuvable.', 'kaelah-ai-connector' ), array( 'status' => 404 ) );
		}

		$summary    = $request->get_param( 'conversationalSummary' );
		$qa_pairs   = $request->get_param( 'qaPairs' );
		$structured = $request->get_param( 'structuredDataSuggestion' );

		if ( null !== $summary ) {
			update_post_meta( $id, '_kaelah_geo_summary', sanitize_textarea_field( $summary ) );
		}
		if ( null !== $qa_pairs && is_array( $qa_pairs ) ) {
			$clean = array();
			foreach ( $qa_pairs as $pair ) {
				if ( ! empty( $pair['question'] ) && ! empty( $pair['answer'] ) ) {
					$clean[] = array(
						'question' => sanitize_text_field( $pair['question'] ),
						'answer'   => sanitize_textarea_field( $pair['answer'] ),
					);
				}
			}
			update_post_meta( $id, '_kaelah_geo_qa', wp_json_encode( $clean ) );
		}
		if ( null !== $structured ) {
			update_post_meta( $id, '_kaelah_geo_structured_note', sanitize_textarea_field( $structured ) );
		}

		return array(
			'id'                       => $id,
			'conversationalSummary'    => get_post_meta( $id, '_kaelah_geo_summary', true ),
			'qaPairs'                  => json_decode( get_post_meta( $id, '_kaelah_geo_qa', true ), true ),
		);
	}

	public function update_homepage_geo( $request ) {
		$summary    = $request->get_param( 'conversationalSummary' );
		$qa_pairs   = $request->get_param( 'qaPairs' );
		$structured = $request->get_param( 'structuredDataSuggestion' );

		if ( null !== $summary ) {
			update_option( 'kaelah_homepage_geo_summary', sanitize_textarea_field( $summary ) );
		}
		if ( null !== $qa_pairs && is_array( $qa_pairs ) ) {
			$clean = array();
			foreach ( $qa_pairs as $pair ) {
				if ( ! empty( $pair['question'] ) && ! empty( $pair['answer'] ) ) {
					$clean[] = array(
						'question' => sanitize_text_field( $pair['question'] ),
						'answer'   => sanitize_textarea_field( $pair['answer'] ),
					);
				}
			}
			update_option( 'kaelah_homepage_geo_qa', wp_json_encode( $clean ) );
		}
		if ( null !== $structured ) {
			update_option( 'kaelah_homepage_geo_structured_note', sanitize_textarea_field( $structured ) );
		}

		return array(
			'conversationalSummary' => get_option( 'kaelah_homepage_geo_summary', '' ),
			'qaPairs'                => json_decode( get_option( 'kaelah_homepage_geo_qa', '' ), true ),
		);
	}

	public function update_homepage_seo( $request ) {
		$seo_title       = $request->get_param( 'seoTitle' );
		$seo_description = $request->get_param( 'seoDescription' );

		if ( null !== $seo_title ) {
			update_option( 'kaelah_homepage_seo_title', sanitize_text_field( $seo_title ) );
		}
		if ( null !== $seo_description ) {
			update_option( 'kaelah_homepage_seo_description', sanitize_text_field( $seo_description ) );
		}

		return array(
			'seoTitle'       => get_option( 'kaelah_homepage_seo_title', '' ),
			'seoDescription' => get_option( 'kaelah_homepage_seo_description', '' ),
		);
	}

	public function get_llms_txt() {
		return array( 'content' => get_option( 'kaelah_llms_txt', '' ) );
	}

	/**
	 * Stores the markdown Kaelah AI has generated, served live at /llms.txt
	 * by Kaelah_Llms_Txt — a curated summary of the site written for LLMs.
	 */
	public function update_llms_txt( $request ) {
		$content = $request->get_param( 'content' );
		if ( null === $content ) {
			return new WP_Error( 'kaelah_missing_content', __( 'Contenu manquant.', 'kaelah-ai-connector' ), array( 'status' => 400 ) );
		}
		update_option( 'kaelah_llms_txt', wp_kses( $content, array() ) );
		return array(
			'content' => get_option( 'kaelah_llms_txt', '' ),
			'url'      => home_url( '/llms.txt' ),
		);
	}

	/**
	 * Returns the site's real, live robots.txt so Kaelah can check whether
	 * known AI crawlers (GPTBot, ClaudeBot, PerplexityBot...) are blocked.
	 */
	public function get_robots_txt() {
		ob_start();
		do_robots();
		$content = ob_get_clean();
		return array( 'content' => $content );
	}

	private function woocommerce_not_active_error() {
		return new WP_Error( 'kaelah_woocommerce_not_active', __( "WooCommerce n'est pas installé ou actif sur ce site.", 'kaelah-ai-connector' ), array( 'status' => 400 ) );
	}

	/**
	 * WooCommerce products are regular WordPress posts (post_type 'product'),
	 * so their SEO/GEO title & description already work through the same
	 * update_seo() / update_geo() endpoints above — this only adds price and
	 * stock, the WooCommerce-specific data those endpoints don't have.
	 */
	public function get_woocommerce_products( $request ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return $this->woocommerce_not_active_error();
		}

		$limit = min( 50, max( 1, (int) $request->get_param( 'limit' ) ?: 10 ) );
		$products = wc_get_products( array( 'limit' => $limit, 'status' => 'publish' ) );

		return array_map(
			function ( $product ) {
				return array(
					'id'             => $product->get_id(),
					'title'          => $product->get_name(),
					'price'          => $product->get_price(),
					'stockStatus'    => $product->get_stock_status(),
					'stockQuantity'  => $product->get_stock_quantity(),
					'link'           => get_permalink( $product->get_id() ),
					'seoTitle'       => get_post_meta( $product->get_id(), '_kaelah_seo_title', true ),
					'seoDescription' => get_post_meta( $product->get_id(), '_kaelah_seo_description', true ),
				);
			},
			$products
		);
	}

	public function get_woocommerce_orders_summary() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return $this->woocommerce_not_active_error();
		}

		$orders = wc_get_orders( array( 'limit' => 100, 'status' => array( 'processing', 'completed', 'on-hold' ) ) );
		$revenue = 0;
		foreach ( $orders as $order ) {
			$revenue += (float) $order->get_total();
		}

		return array(
			'ordersCount' => count( $orders ),
			'revenue'     => round( $revenue, 2 ),
			'currency'    => get_woocommerce_currency(),
		);
	}

	public function get_media( $request ) {
		$limit = min( 100, max( 1, (int) $request->get_param( 'limit' ) ?: 50 ) );
		$attachments = get_posts(
			array(
				'post_type'      => 'attachment',
				'post_mime_type' => 'image',
				'post_status'    => 'inherit',
				'numberposts'    => $limit,
			)
		);

		return array_map(
			function ( $attachment ) {
				return array(
					'id'  => $attachment->ID,
					'url' => wp_get_attachment_url( $attachment->ID ),
					'alt' => get_post_meta( $attachment->ID, '_wp_attachment_image_alt', true ),
				);
			},
			$attachments
		);
	}

	public function update_media_alt( $request ) {
		$id = (int) $request->get_param( 'id' );
		if ( ! get_post( $id ) || 'attachment' !== get_post_type( $id ) ) {
			return new WP_Error( 'kaelah_not_found', __( 'Média introuvable.', 'kaelah-ai-connector' ), array( 'status' => 404 ) );
		}

		$alt = $request->get_param( 'alt' );
		if ( null === $alt ) {
			return new WP_Error( 'kaelah_missing_alt', __( 'Texte alternatif manquant.', 'kaelah-ai-connector' ), array( 'status' => 400 ) );
		}

		update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( $alt ) );

		return array(
			'id'  => $id,
			'url' => wp_get_attachment_url( $id ),
			'alt' => get_post_meta( $id, '_wp_attachment_image_alt', true ),
		);
	}

	/**
	 * Product categories (WooCommerce's product_cat taxonomy) if WooCommerce
	 * is active, otherwise plain WordPress post categories — so this still
	 * works usefully on a blog-only site with no store installed.
	 */
	private function category_taxonomy() {
		return class_exists( 'WooCommerce' ) && taxonomy_exists( 'product_cat' ) ? 'product_cat' : 'category';
	}

	public function get_categories( $request ) {
		$limit = min( 100, max( 1, (int) $request->get_param( 'limit' ) ?: 50 ) );
		$terms = get_terms(
			array(
				'taxonomy'   => $this->category_taxonomy(),
				'hide_empty' => false,
				'number'     => $limit,
			)
		);

		if ( is_wp_error( $terms ) ) {
			return array();
		}

		return array_map(
			function ( $term ) {
				return array(
					'id'             => $term->term_id,
					'title'          => $term->name,
					'link'           => get_term_link( $term ),
					'productCount'   => $term->count,
					'seoTitle'       => get_term_meta( $term->term_id, '_kaelah_seo_title', true ),
					'seoDescription' => get_term_meta( $term->term_id, '_kaelah_seo_description', true ),
				);
			},
			$terms
		);
	}

	public function update_category_seo( $request ) {
		$id = (int) $request->get_param( 'id' );
		$term = get_term( $id, $this->category_taxonomy() );
		if ( ! $term || is_wp_error( $term ) ) {
			return new WP_Error( 'kaelah_not_found', __( 'Catégorie introuvable.', 'kaelah-ai-connector' ), array( 'status' => 404 ) );
		}

		$seo_title       = $request->get_param( 'seoTitle' );
		$seo_description = $request->get_param( 'seoDescription' );

		if ( null !== $seo_title ) {
			update_term_meta( $id, '_kaelah_seo_title', sanitize_text_field( $seo_title ) );
		}
		if ( null !== $seo_description ) {
			update_term_meta( $id, '_kaelah_seo_description', sanitize_text_field( $seo_description ) );
		}

		return array(
			'id'             => $id,
			'title'          => $term->name,
			'seoTitle'       => get_term_meta( $id, '_kaelah_seo_title', true ),
			'seoDescription' => get_term_meta( $id, '_kaelah_seo_description', true ),
		);
	}
}
