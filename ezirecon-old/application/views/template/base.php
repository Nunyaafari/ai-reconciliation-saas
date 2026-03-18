<?php
require_once 'header.php';
require_once 'main-nav.php';
?>

      <!-- Content Wrapper. Contains page content -->
      <div class="content-wrapper">
        <!-- Content Header (Page header) -->
        <section class="content-header">
          <h1>
            <?php echo $title; ?>
          </h1>
          <ol class="breadcrumb">
            <li><a href="#"><i class="fa fa-dashboard"></i> <?php echo $active; ?></a></li>
            <li class="active"><?php echo $caption; ?></li>
          </ol>
        </section>

        <!-- Main content -->
        <section class="content">
          <!-- Info boxes -->
          
          <?php
            $this->load->view($view);
          ?>
         

        </section><!-- /.content -->
      </div><!-- /.content-wrapper -->
<?php
require_once 'footer.php';
?>