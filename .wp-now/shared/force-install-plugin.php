<?php

add_action( 'init', function () {
	// Add plugins directories to auto-active here
	$user_defined_plugins_to_activate = [ /* Enter the plugins directory here */ ];

	$option_name = 'force-install-wp-now-plugin';
	if ( array_key_exists( 'wpNowProjectDir', $_ENV ) && !empty( $_ENV['wpNowProjectDir'] ) && !get_option( $option_name ) ) {
		update_option( $option_name, TRUE );

		if ( !function_exists( 'get_plugins' ) ) {
			require_once( ABSPATH . 'wp-admin/includes/plugin.php' );
		}

		$plugins_to_activate = [ $_ENV['wpNowProjectDir'] ];
		if ( !empty( $user_defined_plugins_to_activate ?? [] ) && is_array( $user_defined_plugins_to_activate ) ) {
			$plugins_to_activate = array_merge( $plugins_to_activate, $user_defined_plugins_to_activate );
		}

		foreach ( get_plugins() as $plugin_path => $plugin_data ) {
			foreach ( $plugins_to_activate as $plugin_to_activate ) {
				if ( strpos( $plugin_path, $plugin_to_activate . '/' ) === 0 && !is_plugin_active( $plugin_path ) ) {
					activate_plugin( $plugin_path );
					break;
				}
			}
		}
	}
}, -99 );