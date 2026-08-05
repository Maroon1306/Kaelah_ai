<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Renders the SEO title/description Kaelah AI has set, directly on the live
 * site — independent of whether a third-party SEO plugin is installed. If a
 * known SEO plugin (Yoast, Rank Math) is active, this defers to it instead,
 * since update_seo() already mirrors values into their own meta keys.
 */
class Kaelah_Frontend {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_filter( 'document_title_parts', array( $this, 'filter_title' ) );
		add_action( 'wp_head', array( $this, 'print_meta_description' ), 1 );
		add_action( 'wp_head', array( $this, 'print_geo_structured_data' ), 2 );
		add_filter( 'robots_txt', array( $this, 'allow_ai_crawlers' ), 10, 2 );
	}

	/**
	 * Explicitly allows well-known AI/GEO crawlers in robots.txt — additive
	 * only (never disallows anything), so a site's own robots rules always
	 * win, but Kaelah's GEO optimizations aren't silently unreachable.
	 */
	public function allow_ai_crawlers( $output, $public ) {
		if ( '0' === (string) $public ) {
			return $output;
		}
		$crawlers = array( 'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'CCBot', 'Bytespider' );
		$output  .= "\n# Kaelah AI — allow known AI/GEO crawlers\n";
		foreach ( $crawlers as $crawler ) {
			$output .= "User-agent: {$crawler}\nAllow: /\n";
		}
		return $output;
	}

	private function has_other_seo_plugin() {
		return defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'AIOSEO_VERSION' );
	}

	public function filter_title( $parts ) {
		if ( $this->has_other_seo_plugin() ) {
			return $parts;
		}

		if ( is_front_page() || is_home() ) {
			$title = get_option( 'kaelah_homepage_seo_title' );
			// Kaelah's title is the full, final <title> tag — no site name
			// suffix appended, so it never overshoots the length budget.
			return $title ? array( 'title' => $title ) : $parts;
		}

		if ( is_singular() ) {
			$title = get_post_meta( get_queried_object_id(), '_kaelah_seo_title', true );
			if ( $title ) {
				return array( 'title' => $title );
			}
		}

		if ( is_category() || is_tax( 'product_cat' ) ) {
			$title = get_term_meta( get_queried_object_id(), '_kaelah_seo_title', true );
			if ( $title ) {
				return array( 'title' => $title );
			}
		}

		return $parts;
	}

	public function print_meta_description() {
		if ( $this->has_other_seo_plugin() ) {
			return;
		}

		$description = '';
		if ( is_front_page() || is_home() ) {
			$description = get_option( 'kaelah_homepage_seo_description' );
		} elseif ( is_singular() ) {
			$description = get_post_meta( get_queried_object_id(), '_kaelah_seo_description', true );
		} elseif ( is_category() || is_tax( 'product_cat' ) ) {
			$description = get_term_meta( get_queried_object_id(), '_kaelah_seo_description', true );
		}

		if ( $description ) {
			printf( '<meta name="description" content="%s" />' . "\n", esc_attr( $description ) );
		}
	}

	/**
	 * Renders a real FAQPage JSON-LD block from the GEO Q&A pairs Kaelah AI
	 * has generated for this content, so generative search engines can
	 * actually discover and cite it.
	 */
	public function print_geo_structured_data() {
		if ( is_front_page() || is_home() ) {
			$qa_json = get_option( 'kaelah_homepage_geo_qa', '' );
		} elseif ( is_singular() ) {
			$qa_json = get_post_meta( get_queried_object_id(), '_kaelah_geo_qa', true );
		} else {
			return;
		}

		if ( empty( $qa_json ) ) {
			return;
		}

		$qa_pairs = json_decode( $qa_json, true );
		if ( empty( $qa_pairs ) || ! is_array( $qa_pairs ) ) {
			return;
		}

		$entities = array();
		foreach ( $qa_pairs as $pair ) {
			if ( empty( $pair['question'] ) || empty( $pair['answer'] ) ) {
				continue;
			}
			$entities[] = array(
				'@type'          => 'Question',
				'name'           => $pair['question'],
				'acceptedAnswer' => array(
					'@type' => 'Answer',
					'text'  => $pair['answer'],
				),
			);
		}

		if ( empty( $entities ) ) {
			return;
		}

		$schema = array(
			'@context'   => 'https://schema.org',
			'@type'      => 'FAQPage',
			'mainEntity' => $entities,
		);

		echo '<script type="application/ld+json">' . wp_json_encode( $schema ) . '</script>' . "\n";
	}
}
