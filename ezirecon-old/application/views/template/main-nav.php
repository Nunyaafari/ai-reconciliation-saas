<?php

?>
      <!-- Left side column. contains the logo and sidebar -->
      <aside class="main-sidebar noprint">
        <!-- sidebar: style can be found in sidebar.less -->
        <section class="sidebar">
          <!-- Sidebar user panel -->
<!--          <div class="user-panel">-->
<!--            <div class="pull-left info">-->
<!--              <p>--><?php //echo $user_sess['fullname']; ?><!--</p>-->
<!--                <div class="pull-left image">-->
<!--                    <img src="--><?php //echo base_url() ?><!--extras/dist/img/avatar.png" class="img-circle" alt="User Image" />-->
<!--                </div>-->
<!--              <a href="#"><i class="fa fa-circle text-success"></i> Online</a>-->
<!--            </div>-->
<!--          </div>-->
          <!-- search form -->
<!--          <form action="#" method="get" class="sidebar-form">-->
<!--            <div class="input-group">-->
<!--              <input type="text" name="q" class="form-control" placeholder="Search..."/>-->
<!--              <span class="input-group-btn">-->
<!--                <button type='submit' name='search' id='search-btn' class="btn btn-flat"><i class="fa fa-search"></i></button>-->
<!--              </span>-->
<!--            </div>-->
<!--          </form>-->
          <!-- /.search form -->
          <!-- sidebar menu: : style can be found in sidebar.less -->
          <ul class="sidebar-menu">
            <li class="header">MAIN NAVIGATION</li>
            <li class="<?php if($active == "Dashboard") echo "active"; ?> treeview">
              <a href="<?php echo base_url(); ?>home">
                <i class="fa fa-dashboard"></i> <span>Dashboard</span>
              </a>
            </li>
              <?php
                if($user_sess['user_role'] == -1 || $user_sess['user_role'] == -5):
              ?>
            <li class="<?php if($active == "Companies") echo "active"; ?> treeview">
              <a href="<?php echo base_url();?>companies">
                <i class="fa fa-files-o"></i>
                <span>Companies</span>
              </a>
            </li>
              <?php
                endif;
              ?>
              <?php
              if($user_sess['user_role'] == -1 || $user_sess['user_role'] == -5 || $user_sess['user_role'] == 0):
              ?>
            <li>
              <a href="<?php echo base_url() ?>users">
                <i class="fa fa-user"></i> <span>Users</span>
              </a>
            </li>
              <?php
               endif;
              ?>
              <?php
              if($user_sess['user_role'] != -1):
              ?>
            <li >
              <a href="<?php echo base_url(); ?>accounts">
                <i class="fa fa-pie-chart"></i>
                <span>Accounts</span>
              </a>
            </li>
              <?php
              endif;
              /*
              ?>
            <li class="treeview">
              <a href="<?php echo base_url(); ?>lock">
                <i class="fa fa-circle-o text-warning"></i>
                <span>Lock</span>
              </a>
            </li>
              <?php
              */
              ?>
              <?php
              if($user_sess['user_role'] == -1 || $user_sess['user_role'] == -5 || $user_sess['user_role'] == 0):
                  ?>
                  <li class="treeview">
                      <a href="<?php echo base_url(); ?>view_logs">
                          <i class="fa fa-eye"></i> <span>System Logs</span>
                      </a>
                  </li>
              <?php
              endif;
              ?>
            <li class="treeview">
              <a href="<?php echo base_url(); ?>logout">
                <i class="fa fa-circle-o text-danger "></i> <span>Logout</span>
              </a>
            </li>
<!--            <li class="treeview">-->
<!--              <a href="--><?php //echo base_url() ?><!--reporting">-->
<!--                <i class="fa fa-circle-o text-info"></i> <span>Complaints / Suggestions</span>-->
<!--              </a>-->
<!--            </li>-->
          </ul>
        </section>
        <!-- /.sidebar -->
      </aside>