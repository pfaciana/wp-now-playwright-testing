<?php

add_action( 'init', function () {
	$option_name = 'force-install-wp-now-plugin';
	if ( array_key_exists( 'wpNowProjectDir', $_ENV ) && !empty( $_ENV['wpNowProjectDir'] ) && !get_option( $option_name ) ) {
		update_option( $option_name, TRUE );

		if ( !function_exists( 'get_plugins' ) ) {
			require_once( ABSPATH . 'wp-admin/includes/plugin.php' );
		}

		foreach ( get_plugins() as $plugin_path => $plugin_data ) {
			if ( strpos( $plugin_path, $_ENV['wpNowProjectDir'] . '/' ) === 0 && !is_plugin_active( $plugin_path ) ) {
				activate_plugin( $plugin_path );
				break;
			}
		}
	}
}, -99 );