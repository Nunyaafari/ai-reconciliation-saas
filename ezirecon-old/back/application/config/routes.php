<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/*
| -------------------------------------------------------------------------
| URI ROUTING
| -------------------------------------------------------------------------
| This file lets you re-map URI requests to specific controller functions.
|
| Typically there is a one-to-one relationship between a URL string
| and its corresponding controller class/method. The segments in a
| URL normally follow this pattern:
|
|	example.com/class/method/id/
|
| In some instances, however, you may want to remap this relationship
| so that a different class/function is called than the one
| corresponding to the URL.
|
| Please see the user guide for complete details:
|
|	http://codeigniter.com/user_guide/general/routing.html
|
| -------------------------------------------------------------------------
| RESERVED ROUTES
| -------------------------------------------------------------------------
|
| There are three reserved routes:
|
|	$route['default_controller'] = 'welcome';
|
| This route indicates which controller class should be loaded if the
| URI contains no data. In the above example, the "welcome" class
| would be loaded.
|
|	$route['404_override'] = 'errors/page_missing';
|
| This route will tell the Router which controller/method to use if those
| provided in the URL cannot be matched to a valid route.
|
|	$route['translate_uri_dashes'] = FALSE;
|
| This is not exactly a route, but allows you to automatically route
| controller and method names that contain dashes. '-' isn't a valid
| class or method name character, so it requires translation.
| When you set this option to TRUE, it will replace ALL dashes in the
| controller and method URI segments.
|
| Examples:	my-controller/index	-> my_controller/index
|		my-controller/my-method	-> my_controller/my_method
*/
$route['default_controller'] = 'site';
$route['companies'] = 'site/companies';
$route['home'] = 'site/home';
$route['new_company'] = 'site/new_company';
$route['add_company_admin'] = 'site/new_company';
$route['edit_company'] = 'site/edit_company';
$route['view_company'] = 'site/view_company';
$route['users'] = 'site/users';
$route['new_user'] = 'site/new_user';
$route['new_system_admin'] = 'site/new_system_admin';
$route['edit_user'] = 'site/edit_user';
$route['edit_profile'] = 'site/edit_profile';
$route['accounts'] = 'site/accounts';
$route['new_account'] = 'site/new_account';
$route['edit_account'] = 'site/edit_account';
$route['view_account'] = 'site/view_account';
$route['logout'] = 'site/logout';
$route['login'] = 'site/login';
$route['lock'] = 'site/lock';
$route['unlock'] = 'site/unlock';
$route['new_recon'] = 'site/new_recon';
$route['recon'] = 'site/recon';
$route['reopen_recon'] = 'site/reopen_recon';
$route['save_recon'] = 'site/save_recon';
$route['add_transaction'] = 'site/add_transaction';
$route['generate_recon_report'] = 'site/generate_recon_report';
$route['default_controller'] = 'site';
$route['404_override'] = 'site/error';
$route['translate_uri_dashes'] = FALSE;
