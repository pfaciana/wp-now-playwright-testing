<?php

$docRoot = $_SERVER['DOCUMENT_ROOT'] ?? getcwd();

( function ( $docRoot ) {
	global $table_prefix;
	include $docRoot . '/wp-includes/version.php';
	$php_version = str_replace( '.', '-', PHP_VERSION );
	$wp_version  = str_replace( '.', '-', $wp_version ?? '0.0.0' );
	define( 'DB_FILE', ".ht_php{$php_version}_wp{$wp_version}.sqlite" );
	$table_prefix = str_replace( '-', '_', "php{$php_version}_wp{$wp_version}_" );
} )( $docRoot );

( function ( $docRoot ) {
	if ( file_exists( $srcFile = $docRoot . '/wp-content/.wp-now/force-install-plugin.php' ) ) {
		copy( $srcFile, $docRoot . '/wp-content/mu-plugins/force-install-plugin.php' );
	}
	$_ENV['wpNowProjectDir'] = '__PROJECT_DIR__';
} )( $docRoot );
