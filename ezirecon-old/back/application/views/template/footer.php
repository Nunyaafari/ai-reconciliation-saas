<?php

?>

      <footer class="main-footer">
        <div class="pull-right hidden-xs">
          <b>Version</b> 2.0
        </div>
        <strong>Copyright &copy; 2014-2015 <a href="http://almsaeedstudio.com">Almsaeed Studio</a>.</strong> All rights reserved.
      </footer>

    </div><!-- ./wrapper -->

    <!-- jQuery 2.1.3 -->
    <script src="<?php echo base_url() ?>extras/plugins/jQuery/jQuery-2.1.3.min.js"></script>
    <!-- Bootstrap 3.3.2 JS -->
    <script src="<?php echo base_url() ?>extras/bootstrap/js/bootstrap.min.js" type="text/javascript"></script>
    <!-- FastClick -->
    <script src='<?php echo base_url() ?>extras/plugins/fastclick/fastclick.min.js'></script>

    <!-- DATA TABES SCRIPT -->
    <script src="<?php echo base_url() ?>extras/plugins/datatables/jquery.dataTables.js" type="text/javascript"></script>
    <script src="<?php echo base_url() ?>extras/plugins/datatables/dataTables.bootstrap.js" type="text/javascript"></script>
    <!-- AdminLTE App -->
    <script src="<?php echo base_url() ?>extras/dist/js/app.min.js" type="text/javascript"></script>
    <!-- Sparkline -->
    <script src="<?php echo base_url() ?>extras/plugins/sparkline/jquery.sparkline.min.js" type="text/javascript"></script>
    <!-- jvectormap -->
    <script src="<?php echo base_url() ?>extras/plugins/jvectormap/jquery-jvectormap-1.2.2.min.js" type="text/javascript"></script>
    <script src="<?php echo base_url() ?>extras/plugins/jvectormap/jquery-jvectormap-world-mill-en.js" type="text/javascript"></script>
    <!-- daterangepicker -->
    <script src="<?php echo base_url() ?>extras/plugins/daterangepicker/daterangepicker.js" type="text/javascript"></script>
    <!-- datepicker -->
    <script src="<?php echo base_url() ?>extras/plugins/datepicker/bootstrap-datepicker.js" type="text/javascript"></script>
    <!-- iCheck -->
    <script src="<?php echo base_url() ?>extras/plugins/iCheck/icheck.min.js" type="text/javascript"></script>
    <!-- SlimScroll 1.3.0 -->
    <script src="<?php echo base_url() ?>extras/plugins/slimScroll/jquery.slimscroll.min.js" type="text/javascript"></script>
    <!-- ChartJS 1.0.1 -->
    <script src="<?php echo base_url() ?>extras/plugins/chartjs/Chart.min.js" type="text/javascript"></script>
    <!--- Idle time -->
    <script src="<?php echo base_url() ?>extras/dist/idle-timer.js" type="text/javascript"></script>
    <script src="<?php echo base_url() ?>extras/dist/qunit.js" type="text/javascript"></script>
    <script src="<?php echo base_url() ?>extras/dist/jquery-form.js" type="text/javascript"></script>
    <script src="<?php echo base_url() ?>extras/dist/form_process.js" type="text/javascript"></script>
    <script src="<?php echo base_url() ?>extras/dist/bootstrapValidator.js" type="text/javascript"></script>
<?php
/*
?>
    <!-- AdminLTE dashboard demo (This is only for demo purposes) -->
    <script src="<?php echo base_url() ?>extras/dist/js/pages/dashboard2.js" type="text/javascript"></script>
<?php
*/
?>

    <!-- AdminLTE for demo purposes -->
    <script src="<?php echo base_url() ?>extras/dist/js/demo.js" type="text/javascript"></script>



<script type="text/javascript">
    $(function () {
        $("#example1").dataTable();
    });
    $( document ).idleTimer(1000);
    $( document ).on( "idle.idleTimer", function(event, elem, obj){
       console.log("idle");
    });
</script>

  </body>
</html>