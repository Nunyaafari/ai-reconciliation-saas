<?php

?>
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title><?php echo $title ?></title>
    <meta content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' name='viewport'>
    <!-- Bootstrap 3.3.2 -->
    <link href="<?php echo base_url() ?>extras/bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <!-- Font Awesome Icons -->
    <link href="https://maxcdn.bootstrapcdn.com/font-awesome/4.3.0/css/font-awesome.min.css" rel="stylesheet" type="text/css" />
    <!-- Ionicons -->
    <link href="http://code.ionicframework.com/ionicons/2.0.0/css/ionicons.min.css" rel="stylesheet" type="text/css" />
    <!-- Morris chart -->
    <link href="<?php echo base_url() ?>extras/plugins/morris/morris.css" rel="stylesheet" type="text/css" />
    <!-- jvectormap -->
    <link href="<?php echo base_url() ?>extras/plugins/jvectormap/jquery-jvectormap-1.2.2.css" rel="stylesheet" type="text/css" />
    <!-- Daterange picker -->
    <link href="<?php echo base_url() ?>extras/plugins/daterangepicker/daterangepicker-bs3.css" rel="stylesheet" type="text/css" />
    <!-- Theme style -->
    <link href="<?php echo base_url() ?>extras/dist/css/AdminLTE.min.css" rel="stylesheet" type="text/css" />
      <link href="<?php echo base_url() ?>extras/plugins/datatables/dataTables.bootstrap.css" rel="stylesheet" type="text/css" />
      <link href="<?php echo base_url() ?>extras/css/mess-style.css" rel="stylesheet" type="text/css" />

      <link href="<?php echo base_url() ?>extras/plugins/iCheck/all.css" rel="stylesheet" type="text/css" />
      <link href="<?php echo base_url() ?>extras/plugins/iCheck/all.css" rel="stylesheet" type="text/css" />

      <!-- AdminLTE Skins. Choose a skin from the css/skins
           folder instead of downloading all of them to reduce the load. -->
    <link href="<?php echo base_url() ?>extras/dist/css/skins/_all-skins.min.css" rel="stylesheet" type="text/css" />
    <link href="<?php echo base_url() ?>extras/css/datepicker.css" rel="stylesheet" type="text/css" />
      <style type="text/css">
          @media print
          {
              .noprint {display:none;}
          }
      </style>

    <!-- HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
        <script src="https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
        <script src="https://oss.maxcdn.com/libs/respond.js/1.3.0/respond.min.js"></script>
    <![endif]-->
  </head>
  <body class="skin-blue">
    <div class="wrapper">
      
      <header class="main-header noprint">
        <!-- Logo -->
          <a href="<?php echo base_url(); ?>" class="logo">
              <img src="<?php echo base_url() ?>extras/dist/img/ezirecon.png" class="img-circle" alt="Logo" width="22%"/>
              <b>Ezi</b>recon</a>
        <!-- Header Navbar: style can be found in header.less -->
        <nav class="navbar navbar-static-top" role="navigation">
          <!-- Sidebar toggle button-->
          <a href="#" class="sidebar-toggle" data-toggle="offcanvas" role="button">
            <span class="sr-only">Toggle navigation</span>
          </a>
          <!-- Navbar Right Menu -->
          <div class="navbar-custom-menu">
            <ul class="nav navbar-nav">
              <!-- Messages: style can be found in dropdown.less-->

              <li class="dropdown user user-menu">
                <a href="#" class="dropdown-toggle" data-toggle="dropdown">
<!--                    <img src="--><?php //echo base_url() ?><!--extras/dist/img/avatar.png" class="user-image" alt="User Image" />-->
                    <span class="hidden-xs">Welcome <br/><?php echo $user_sess['fullname']; ?></span>
                </a>
                <ul class="dropdown-menu">
                  <!-- User image -->
<!--                  <li class="user-header">-->
<!--                    <img src="--><?php //echo base_url() ?><!--extras/dist/img/user2-160x160.jpg" class="img-circle" alt="User Image" />-->
<!--                    <p>-->
<!--                      Alexander Pierce - Web Developer-->
<!--                      <small>Member since Nov. 2012</small>-->
<!--                    </p>-->
<!--                  </li>-->
                  <!-- Menu Body -->
<!--                  <li class="user-body">-->
<!--                    <div class="col-xs-4 text-center">-->
<!--                      <a href="#">Followers</a>-->
<!--                    </div>-->
<!--                    <div class="col-xs-4 text-center">-->
<!--                      <a href="#">Sales</a>-->
<!--                    </div>-->
<!--                    <div class="col-xs-4 text-center">-->
<!--                      <a href="#">Friends</a>-->
<!--                    </div>-->
<!--                  </li>-->
                  <!-- Menu Footer-->
                  <li class="user-footer">
                    <div class="pull-left">
                      <a href="<?php echo base_url(); ?>edit_user/<?php echo $user_sess['id']; ?>" class="btn btn-default btn-flat">Profile</a>
                    </div>
                    <div class="pull-right">
                      <a href="<?php echo base_url() ?>site/logout" class="btn btn-default btn-flat">Sign out</a>
                    </div>
                  </li>
                </ul>
              </li>
            </ul>
          </div>
        </nav>
      </header>