<?php

?>
      <!-- Left side column. contains the logo and sidebar -->
      <aside class="main-sidebar">
        <!-- sidebar: style can be found in sidebar.less -->
        <section class="sidebar">
          <!-- Sidebar user panel -->
          <div class="user-panel">
            <div class="pull-left image">
              <img src="<?php echo base_url() ?>extras/dist/img/user2-160x160.jpg" class="img-circle" alt="User Image" />
            </div>
            <div class="pull-left info">
              <p>Alexander Pierce</p>

              <a href="#"><i class="fa fa-circle text-success"></i> Online</a>
            </div>
          </div>
          <!-- search form -->
          <form action="#" method="get" class="sidebar-form">
            <div class="input-group">
              <input type="text" name="q" class="form-control" placeholder="Search..."/>
              <span class="input-group-btn">
                <button type='submit' name='search' id='search-btn' class="btn btn-flat"><i class="fa fa-search"></i></button>
              </span>
            </div>
          </form>
          <!-- /.search form -->
          <!-- sidebar menu: : style can be found in sidebar.less -->
          <ul class="sidebar-menu">
            <li class="header">MAIN NAVIGATION</li>
            <li class="<?php if($active == "Dashboard") echo "active"; ?> treeview">
              <a href="<?php echo base_url(); ?>home">
                <i class="fa fa-dashboard"></i> <span>Dashboard</span> <i class="fa fa-angle-left pull-right"></i>
              </a>
            </li>
            <li class="<?php if($active == "Companies") echo "active"; ?> treeview">
              <a href="<?php echo base_url();?>companies">
                <i class="fa fa-files-o"></i>
                <span>Companies</span>
                <span class="label label-primary pull-right">4</span>
              </a>
            </li>
            <li>
              <a href="<?php echo base_url() ?>users">
                <i class="fa fa-user"></i> <span>Users</span> <small class="label pull-right bg-green">8</small>
              </a>
            </li>
            <li class="treeview">
              <a href="<?php echo base_url(); ?>accounts">
                <i class="fa fa-pie-chart"></i>
                <span>Reconciliations</span>
                <i class="fa fa-angle-left pull-right"></i>
              </a>
            </li>
            <li class="treeview">
              <a href="<?php echo base_url(); ?>lock">
                <i class="fa fa-ccircle-o text-warning"></i>
                <span>Lock</span>
                <i class="fa fa-angle-left pull-right"></i>
              </a>
            </li>
            <li class="treeview">
              <a href="<?php echo base_url(); ?>logout">
                <i class="fa fa-circle-o text-danger "></i> <span>Logout</span>
                <i class="fa fa-angle-left pull-right"></i>
              </a>
            </li>
            <li class="treeview">
              <a href="<?php echo base_url() ?>reporting">
                <i class="fa fa-circle-o text-info"></i> <span>Complaints / Suggestions</span>
                <i class="fa fa-angle-left pull-right"></i>
              </a>
            </li>
          </ul>
        </section>
        <!-- /.sidebar -->
      </aside>