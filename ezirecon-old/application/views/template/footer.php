<?php

?>
<div class="modal fade" id="save_modal">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title">Bank Statement Closing Balance</h4>
            </div>
            <div class="modal-body">
                <div class="ajax_message" id="ajax_message">

                </div>
                <form role="form" id="new_recon" class="new_recon">
                    <div class="box-body">
                        <div class="form-group">
                            <label for="exampleInputPassword1">Bank Statement Closing Balance</label>
                            <div class="input-group">

                                <input type="text" class="form-control"  name="bank_opening" id="bs_closing_balance" placeholder="Enter Bank Statement Closing Balance">
                                <div class="input-group-addon">
                                    <i>Ghc</i>
                                </div>
                            </div>
                        </div>
                        </div>
                    </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="save();">Save</button>
            </div>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->
<div class="modal fade" id="add_comment">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title">Transaction Comment</h4>
            </div>
            <div class="modal-body">
                <div class="ajax_message" id="ajax_message">
                </div>
                <form role="form" id="new_transaction_comment" class="new_recon">
                    <div class="box-body">
                        <div class="form-group">
                            <label for="exampleInputPassword1">Comment</label>
                            <div class="input-group">

                                <input type="text" class="form-control"  name="comment" id="comment" placeholder="Enter transaction comment here" value="">
                                <div class="input-group-addon">
                                    <i class="fa fa-comments"></i>
                                </div>
                                <input type="hidden" class="form-control"  name="id_comment" id="id_comment" value="">
                            </div>
                        </div>
                        </div>
                    </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="add_comment();">Save</button>
            </div>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->
<!--New Transaction modal-->
<div class="modal fade noprint" id="upload_transaction">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title">Upload Excel</h4>
            </div>
            <div class="modal-body">
                <div class="ajax_message" id="ajax_message">

                </div>
                <form role="form" id="new_transaction" class="new_transaction" enctype="multipart/form-data">
                    <div class="box-body">
                        <input type="hidden" class="form-control" name="id_account" id="exampleInputEmail1" value="<?php echo $account['id']; ?>">
                        <input type="hidden" class="form-control" name="id_user" id="exampleInputEmail1" value="<?php echo $user_sess['id']; ?>">
                            <input type="hidden" name="transaction_type" id="transaction_type"/>
                            <input type="hidden" name="transaction_from" id="transaction_from"/>

                        <div class="form-group">
                            <label for="exampleInputFile">Upload Your Excel File</label>
                            <input type="file" name="userfile" id="exampleInputFile">
                            <p class="help-block">New Excel</p>
                        </div>
                    </div><!-- /.box-body -->
                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary">Submit</button>
                    </div>
                </form>
            </div>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->
<div class="modal fade noprint" id="add_transaction">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title">New Transaction</h4>
            </div>
            <div class="modal-body">
                <div class="ajax_message" id="ajax_message">

                </div>
                <form role="form" id="new_recon" class="new_recon">
                    <div class="box-body">
                        <div class="form-group">
                            <label for="exampleInputEmail1">Narration</label>
                            <input type="text" class="form-control" name="narration" id="narration" placeholder="Enter transaction narration">
                            <input type="hidden" class="form-control" name="id_account" id="id_account" value="<?php echo $account['id']; ?>">
                            <input type="hidden" class="form-control" name="id_user" id="id_user" value="<?php echo $user_sess['id']; ?>">
                            <input type="hidden" class="form-control" name="class_to_add" id="class_to_add" value="">
                        </div>
                        <div class="form-group">
                            <label for="exampleInputEmail1">Reference</label>
                            <input type="text" class="form-control" name="ref" id="ref" placeholder="Enter transaction reference">
                        </div>
                        <div class="form-group">
                            <label for="exampleInputPassword1">Amount</label>
                            <input type="text" class="form-control" name="amount" id="amount" placeholder="Enter amount">
                        </div>
                        <div class="form-group">
                            <label>Date:</label>
                            <div class="input-group">
                                <div class="input-group-addon">
                                    <i class="fa fa-calendar"></i>
                                </div>
                                <input id="datemask" type="text" name="date" class="form-control date" data-inputmask="'alias': 'yyyy-mm-dd'" data-mask/>
                            </div><!-- /.input group -->
                        </div><!-- /.form group -->
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="transaction();">Add</button>
            </div>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->

      <footer class="main-footer noprint">
        <div class="pull-right hidden-xs">
          <b>Version</b> 1.0
        </div>
        <strong>Copyright &copy; <?php echo date("Y",time()); ?> <a href="http://www.finxlgh.com/">Finxl Business Solutions </a>.</strong> All rights reserved.<?php
          $this->db->where('id',$user_sess['id_company']);
          $company = $this->db->get('companies')->row();
          if($company && ( $company->expiry -strtotime("+30 days")) <0) {
              ?>
                  <div class="alert alert-danger">
                      <strong> Sorry Your Companies Account Expires In Less Than 30 days</strong>
                  </div>
              <?php
          }
          ?>
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

    <script src="<?php echo base_url() ?>extras/dist/js/idle-timer.js" type="text/javascript"></script>

    <script src="<?php echo base_url() ?>extras/dist/js/jquery-form.js" type="text/javascript"></script>
    <script src="<?php echo base_url() ?>extras/dist/js/form_process.js" type="text/javascript"></script>
    <script src="<?php echo base_url() ?>extras/dist/js/bootstrapValidator.js" type="text/javascript"></script>



<!-- ChartJS 1.0.1 -->
    <script src="<?php echo base_url() ?>extras/plugins/chartjs/Chart.min.js" type="text/javascript"></script>

<?php
/*
?>
    <!-- AdminLTE dashboard demo (This is only for demo purposes) -->
    <script src="<?php echo base_url() ?>extras/dist/js/pages/dashboard2.js" type="text/javascript"></script>
<?php
*/
?>

    <!-- AdminLTE for demo purposes -->
<!--    <script src="--><?php //echo base_url() ?><!--extras/dist/js/demo.js" type="text/javascript"></script>-->



<script type="text/javascript">
    $(".datepick").datepicker( {
        format: "mm/d/yyyy"
    });


    $(function ()
    {

        var ccredit_table = $("#example1").DataTable();
        var bdebit_table =  $("#example2").DataTable();
        var cdebit_table = $("#example3").DataTable();
        var bcredit_table =  $("#example4").DataTable();

    });
//    $( document ).idleTimer(1000);
    $( document ).idleTimer();
    $( document ).on( "idle.idleTimer",
        function(event, elem, obj)
        {
       console.log("idle");
    });
</script>



<?php
    if($caption== "Add System Administrator"):
?>
<script>
    $(".new_user").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>users/register_sys_admin",
            dataType: "json",
            cache: false,
            data: $('#new_user').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, system administrator account added </p></div>').show().addClass('ajax_success');
                    $(".ajax_message").html('');

                    console.log(data);
                        window.location = "<?php echo base_url();?>index.php/site/users";
                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_user').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>
<?php
    if($caption== "Add new company"):
?>
<script>
    $(".new_company").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/add_company",
            dataType: "json",
            cache: false,
            data: $('#new_company').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, company added successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>index.php/site/add_company_admin";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_company').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>
<?php
    if($caption== "Add new company administrator"):
?>
<script>
    $(".new_admin_user").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>users/register_company_admin",
            dataType: "json",
            cache: false,
            data: $('#new_admin_user').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, company administrator successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>index.php/site/users";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_admin_user').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>

<?php
    if($caption== "Add User"):
?>
<script>
    $(".new_admin_user").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>users/register_user",
            dataType: "json",
            cache: false,
            data: $('#new_admin_user').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, user added successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>index.php/site/users";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_admin_user').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>

<?php
    if($caption== "Modify Company Details"):
?>
<script>


    $(".edit_company").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/update_company",
            dataType: "json",
            cache: false,
            data: $('#edit_company').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, company modified successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>index.php/site/companies";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.edit_company').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>


<?php
    if($caption== "Edit User Details"):
?>
<script>
    $(".edit_user").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/update_user",
            dataType: "json",
            cache: false,
            data: $('#edit_user').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, user edited successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        setTimeout(function(e)
                            {
                                window.location.reload();
                            }
                            ,500);
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.edit_user').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>
<?php
    if($caption== "Add New Account"):
?>
<script>
    $(".new_account").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/add_account",
            dataType: "json",
            cache: false,
            data: $('#new_account').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, account added successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>index.php/site/accounts";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_account').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>
<?php
    if($caption== "Edit Account Details"):
?>
<script>
    $(".edit_account").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/edit_account_details",
            dataType: "json",
            cache: false,
            data: $('#edit_account').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, account edited successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>index.php/site/accounts";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.edit_account').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>
<?php
    if($caption== "Add New Transaction"):
?>
        <!-- InputMask -->
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.date.extensions.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.extensions.js" type="text/javascript"></script>

        <script>
    $("#datemask").inputmask("yyyy-mm-dd", {"placeholder": "yyyy-mm-dd"});

    $(".new_transaction").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/add_single_transaction",
            dataType: "json",
            cache: false,
            data: $('#new_transaction').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, transaction added successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>index.php/site/accounts";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_transaction').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>
<?php
    if($caption== "Setup Single Transaction"):
?>
        <!-- InputMask -->
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.date.extensions.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.extensions.js" type="text/javascript"></script>

        <script>
    $("#datemask").inputmask("yyyy-mm-dd", {"placeholder": "yyyy-mm-dd"});

    $(".new_setup_transaction").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/add_setup_single_transaction",
            dataType: "json",
            cache: false,
            data: $('#new_setup_transaction').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, transaction added successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>setup_preview/<?php echo $account['id']; ?>";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_setup_transaction').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>
<?php
    if($caption== "Upload New Excel Document"):
?>
        <!-- InputMask -->

        <script>

    $(".new_transaction").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/add_multi_transaction",
            dataType: "json",
            cache: false,
            data: $('#new_transaction').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, transaction added successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>upload_preview/<?php echo $this->uri->segment(2) ?>";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_transaction').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>
<?php
    if($caption== "Upload Setup Excel Document"):
?>
        <!-- InputMask -->

        <script>

    $(".new_setup_upload_transaction").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/site/add_multi_setup_transaction",
            dataType: "json",
            cache: false,
            data: $('#new_setup_upload_transaction').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, transactions uploaded successfully </p></div>').show().addClass('ajax_success');
                    console.log(data);
                        window.location = "<?php echo base_url();?>setup_upload_preview/<?php echo $account['id']; ?>";
                    $(".ajax_message").html('');

                } else if (data.status == 'error') {
                    console.log(data);
                    $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                }
            },
            error: function () {
                $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
            }

        };

        e.preventDefault();
        $('.new_setup_upload_transaction').ajaxSubmit(options);

    });

</script>
<?php
    endif;
?>

<?php
    if($caption == "All Companies"):
?>
    <script>
        function delete_company(id){
            $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            $.post('<?php echo base_url() ?>index.php/site/remove_company',{id : id},function(e){
                e = JSON.parse(e);
                if(e.status == 'success'){
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, company deleted successfully </p></div>').show().addClass('ajax_success');
                    location.reload();
                    $(".ajax_message").html('');

                }
            });

        }
    </script>

<?php
endif;
?>
<?php
    if($caption == "List of system users"):
?>
    <script>
        function delete_user(id){
            $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            $.post('<?php echo base_url() ?>index.php/site/remove_user',{id : id},function(e){
                e = JSON.parse(e);
                if(e.status == 'success'){
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, user deleted successfully </p></div>').show().addClass('ajax_success');
                    location.reload();
                    $(".ajax_message").html('');

                }
            });

        }
    </script>

<?php
endif;
    if($caption == "List Of All Accounts"):
?>
        <script src="<?php echo base_url() ?>extras/js/bootbox.min.js" type="text/javascript"></script>

        <script>
        function delete_account(id){
            $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            bootbox.confirm("Are you sure you want to delete this account <br> This action cannot be reversed Continue ?",function(reply){
                if(reply)
                {


                    $.post('<?php echo base_url() ?>index.php/site/remove_account',{id : id},function(e){
                        e = JSON.parse(e);
                        if(e.status == 'success'){
                            $(".ajax_message").html('');
                            $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, account deleted successfully </p></div>').show().addClass('ajax_success');
                            location.reload();
                            $(".ajax_message").html('');

                        }
                    });
                }
                else
                {

                }

            });

        }
    </script>

<?php
endif;
?>
<?php
    if($caption == "Upload Preview"):


?>


        <script>

            $("#example1").DataTable();
            $("#example2").DataTable();
            $("#example3").DataTable();
            $("#example4").DataTable();


            function commit_setup()
            {
                $.post('<?php echo base_url();?>index.php/site/commit_setup_multi_upload',{id_account: "<?php echo $this->uri->segment(2); ?>"}, function(rep)
                    {
                        $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, transactions saved successfully </p></div>').show().addClass('ajax_success');
                        window.location = "<?php echo base_url();?>setup_preview/<?php echo $account['id']; ?>";

                    }
                );
            }

            function commit_upload()
            {
                $.post('<?php echo base_url();?>index.php/site/commit_multi_upload',{id_account: "<?php echo $this->uri->segment(2); ?>"}, function(rep)
                    {
                        $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, transactions saved successfully </p></div>').show().addClass('ajax_success');
                        window.location = "<?php echo base_url();?>reconciliations/<?php echo $account['id']; ?>";

                    }
                );
            }
        </script>
    <?php
endif;
    if($caption == "Transactions Details"):
?>
        <!-- iCheck 1.0.1 -->
        <script src="<?php echo base_url() ?>extras/js/accounting.min.js" type="text/javascript"></script>
        <script src="<?php echo base_url() ?>extras/js/date.js" type="text/javascript"></script>
        <script src="<?php echo base_url() ?>extras/js/jspdf.js" type="text/javascript"></script>
        <script src="<?php echo base_url() ?>extras/js/bootbox.min.js" type="text/javascript"></script>
        <script src="<?php echo base_url() ?>extras/js/jspdf.plugin.standard_fonts_metrics.js" type="text/javascript"></script>
        <script src="<?php echo base_url() ?>extras/js/jspdf.plugin.split_text_to_size.js" type="text/javascript"></script>
        <script src="<?php echo base_url() ?>extras/js/jspdf.plugin.from_html.js" type="text/javascript"></script>
        <script src="<?php echo base_url() ?>extras/js/date-en-US.js" type="text/javascript"></script>
        <script src="<?php echo base_url() ?>extras/plugins/iCheck/icheck.min.js" type="text/javascript"></script>
        <!-- FastClick -->
        <!-- AdminLTE App -->
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.date.extensions.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.extensions.js" type="text/javascript"></script>


        <script>
            function new_comment(comment,id)
            {
                $("#comment").val(comment);
                $("#id_comment").val(id);
                $(".ajax_message").html('');
                $("#add_comment").modal("show");


            }
            function add_comment()
            {
             var comment = $("#comment").val();
                var transaction = $("#id_comment").val();
                console.log("Comment = "+comment+" transaction = "+transaction);
                // post to page and
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
                $.post("<?php echo base_url(); ?>index.php/site/edit_comment",
                    {id : transaction,comment : comment},
                    function(e){
                        e = JSON.parse(e);
                        if(e.status == "success")
                        {
                            $(".ajax_message").html('');
                            $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, comment saved successfully. </p></div>').show().addClass('ajax_success');
                            $("#add_comment").modal("hide");
                        }
                        else
                        {

                            $(".ajax_message").html('<br/><div class="error "><p>' + e.error + "</p></div><br/>");

                        }

                    });
            }
            var ccredit_table = $("#example1").DataTable(
                {
                    "fnDrawCallback": function( oSettings ) {
                        $('input[type="checkbox"].flat-red, input[type="radio"].flat-red').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_cash_b_c').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_cash_b_d').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_bank_s_d').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_bank_s_c').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input.check_cash_b_c').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.cash_b_c').iCheck('check');
                            } else {
                                $('input.cash_b_c').iCheck('uncheck');
                            }
                        });
                        $('input.check_cash_b_c').iCheck('uncheck');
                        $('input.cash_b_c').on('ifUnchecked', function(event) {
                            $('input.check_cash_b_c').iCheck('uncheck');
                        });
                        $('input.check_cash_b_d').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.cash_b_d').iCheck('check');
                            } else {
                                $('input.cash_b_d').iCheck('uncheck');
                            }
                        });
                        $('input.check_cash_b_d').iCheck('uncheck');
                        $('input.cash_b_c').on('ifUnchecked', function(event) {
                            $('input.check_cash_b_d').iCheck('uncheck');
                        });

                        $('input.check_bank_s_d').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.bank_s_d').iCheck('check');
                            } else {
                                $('input.bank_s_d').iCheck('uncheck');
                            }
                        });
                        $('input.check_bank_s_d').iCheck('uncheck');

                        $('input.bank_s_d').on('ifUnchecked', function(event) {
                            $('input.check_bank_s_d').iCheck('uncheck');
                        });


                        $('input.check_bank_s_c').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.bank_s_c').iCheck('check');
                            } else {
                                $('input.bank_s_c').iCheck('uncheck');
                            }
                        });
                        $('input.check_bank_s_c').iCheck('uncheck');
                        $('input.bank_s_c').on('ifUnchecked', function(event) {
                            $('input.check_bank_s_c').iCheck('uncheck');
                        });


                        $('input.flat-red').on('ifChecked ifUnchecked', function(event){
                            var data = 0;
                            var counter = 0;
                            $(event.target).closest('td').siblings("td").each(function()
                            {
                                if(counter == 3)
                                {
                                    data = accounting.unformat($(this).html());
                                }
                                counter += 1;
                            });
                            // data now equals amount

                            //get id of the transaction from the tr by setting the tr class to equal the id
                            var str = $(event.target).closest('tr').attr('id');
                            var spl = str.split("_");
                            if(spl[0] == "bank")
                            {
                                console.log(spl[1]);
                                edit_bank(spl[1],data,spl[2]);
                            }
                            else
                            {
                                if(spl[0] == "cash")
                                {
                                    console.log(spl[1]);
                                    edit_cash(spl[1],data,spl[2]);
                                }
                            }
                        });
                    }
                }
            );
            var bdebit_table =  $("#example2").DataTable(
                {
                    "fnDrawCallback": function( oSettings ) {
                        $('input[type="checkbox"].flat-red, input[type="radio"].flat-red').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_cash_b_c').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_cash_b_d').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_bank_s_d').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_bank_s_c').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input.check_cash_b_c').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.cash_b_c').iCheck('check');
                            } else {
                                $('input.cash_b_c').iCheck('uncheck');
                            }
                        });
                        $('input.check_cash_b_c').iCheck('uncheck');

                        $('input.cash_b_c').on('ifUnchecked', function(event) {
                            $('input.check_cash_b_c').iCheck('uncheck');
                        });
                        $('input.check_cash_b_d').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.cash_b_d').iCheck('check');
                            } else {
                                $('input.cash_b_d').iCheck('uncheck');
                            }
                        });
                        $('input.check_cash_b_d').iCheck('uncheck');

                        $('input.cash_b_c').on('ifUnchecked', function(event) {
                            $('input.check_cash_b_d').iCheck('uncheck');
                        });

                        $('input.check_bank_s_d').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.bank_s_d').iCheck('check');
                            } else {
                                $('input.bank_s_d').iCheck('uncheck');
                            }
                        });
                        $('input.check_bank_s_d').iCheck('uncheck');

                        $('input.bank_s_d').on('ifUnchecked', function(event) {
                            $('input.check_bank_s_d').iCheck('uncheck');
                        });


                        $('input.check_bank_s_c').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.bank_s_c').iCheck('check');
                            } else {
                                $('input.bank_s_c').iCheck('uncheck');
                            }
                        });
                        $('input.check_bank_s_c').iCheck('uncheck');

                        $('input.bank_s_c').on('ifUnchecked', function(event) {
                            $('input.check_bank_s_c').iCheck('uncheck');
                        });


                        $('input.flat-red').on('ifChecked ifUnchecked', function(event){
                            var data = 0;
                            var counter = 0;
                            $(event.target).closest('td').siblings("td").each(function()
                            {
                                if(counter == 3)
                                {
                                    data = accounting.unformat($(this).html());
                                }
                                counter += 1;
                            });
                            // data now equals amount

                            //get id of the transaction from the tr by setting the tr class to equal the id
                            var str = $(event.target).closest('tr').attr('id');
                            var spl = str.split("_");
                            if(spl[0] == "bank")
                            {
                                console.log(spl[1]);
                                edit_bank(spl[1],data,spl[2]);
                            }
                            else
                            {
                                if(spl[0] == "cash")
                                {
                                    console.log(spl[1]);
                                    edit_cash(spl[1],data,spl[2]);
                                }
                            }
                        });
                    }
                }
            );
            var cdebit_table = $("#example3").DataTable(
                {
                    "fnDrawCallback": function( oSettings ) {
                        $('input[type="checkbox"].flat-red, input[type="radio"].flat-red').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_cash_b_c').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_cash_b_d').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_bank_s_d').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_bank_s_c').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input.check_cash_b_c').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.cash_b_c').iCheck('check');
                            } else {
                                $('input.cash_b_c').iCheck('uncheck');
                            }
                        });
                        $('input.check_cash_b_c').iCheck('uncheck');

                        $('input.cash_b_c').on('ifUnchecked', function(event) {
                            $('input.check_cash_b_c').iCheck('uncheck');
                        });
                        $('input.check_cash_b_d').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.cash_b_d').iCheck('check');
                            } else {
                                $('input.cash_b_d').iCheck('uncheck');
                            }
                        });
                        $('input.check_cash_b_d').iCheck('uncheck');
                        $('input.cash_b_c').on('ifUnchecked', function(event) {
                            $('input.check_cash_b_d').iCheck('uncheck');
                        });

                        $('input.check_bank_s_d').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.bank_s_d').iCheck('check');
                            } else {
                                $('input.bank_s_d').iCheck('uncheck');
                            }
                        });
                        $('input.check_bank_s_d').iCheck('uncheck');

                        $('input.bank_s_d').on('ifUnchecked', function(event) {
                            $('input.check_bank_s_d').iCheck('uncheck');
                        });


                        $('input.check_bank_s_c').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.bank_s_c').iCheck('check');
                            } else {
                                $('input.bank_s_c').iCheck('uncheck');
                            }
                        });
                        $('input.check_bank_s_c').iCheck('uncheck');
                        $('input.bank_s_c').on('ifUnchecked', function(event) {
                            $('input.check_bank_s_c').iCheck('uncheck');
                        });


                        $('input.flat-red').on('ifChecked ifUnchecked', function(event){
                            var data = 0;
                            var counter = 0;
                            $(event.target).closest('td').siblings("td").each(function()
                            {
                                if(counter == 3)
                                {
                                    data = accounting.unformat($(this).html());
                                }
                                counter += 1;
                            });
                            // data now equals amount

                            //get id of the transaction from the tr by setting the tr class to equal the id
                            var str = $(event.target).closest('tr').attr('id');
                            var spl = str.split("_");
                            if(spl[0] == "bank")
                            {
                                console.log(spl[1]);
                                edit_bank(spl[1],data,spl[2]);
                            }
                            else
                            {
                                if(spl[0] == "cash")
                                {
                                    console.log(spl[1]);
                                    edit_cash(spl[1],data,spl[2]);
                                }
                            }
                        });
                    }
                }
            );
            var bcredit_table =  $("#example4").DataTable(
                {
                    "fnDrawCallback": function( oSettings ) {
                        $('input[type="checkbox"].flat-red, input[type="radio"].flat-red').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_cash_b_c').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_cash_b_d').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_bank_s_d').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input[type="checkbox"].check_bank_s_c').iCheck({
                            checkboxClass: 'icheckbox_flat-red',
                            radioClass: 'iradio_flat-red'
                        });
                        $('input.check_cash_b_c').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.cash_b_c').iCheck('check');
                            } else {
                                $('input.cash_b_c').iCheck('uncheck');
                            }
                        });
                        $('input.check_cash_b_c').iCheck('uncheck');
                        $('input.cash_b_c').on('ifUnchecked', function(event) {
                            $('input.check_cash_b_c').iCheck('uncheck');
                        });
                        $('input.check_cash_b_d').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.cash_b_d').iCheck('check');
                            } else {
                                $('input.cash_b_d').iCheck('uncheck');
                            }
                        });
                        $('input.check_cash_b_d').iCheck('uncheck');
                        $('input.cash_b_c').on('ifUnchecked', function(event) {
                            $('input.check_cash_b_d').iCheck('uncheck');
                        });

                        $('input.check_bank_s_d').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.bank_s_d').iCheck('check');
                            } else {
                                $('input.bank_s_d').iCheck('uncheck');
                            }
                        });
                        $('input.check_bank_s_d').iCheck('uncheck');
                        $('input.bank_s_d').on('ifUnchecked', function(event) {
                            $('input.check_bank_s_d').iCheck('uncheck');
                        });


                        $('input.check_bank_s_c').on('ifChecked ifUnchecked', function(event) {
                            if (event.type == 'ifChecked') {
                                $('input.bank_s_c').iCheck('check');
                            } else {
                                $('input.bank_s_c').iCheck('uncheck');
                            }
                        });
                        $('input.check_bank_s_c').iCheck('uncheck');
                        $('input.bank_s_c').on('ifUnchecked', function(event) {
                            $('input.check_bank_s_c').iCheck('uncheck');
                        });


                        $('input.flat-red').on('ifChecked ifUnchecked', function(event){
                            var data = 0;
                            var counter = 0;
                            $(event.target).closest('td').siblings("td").each(function()
                            {
                                if(counter == 3)
                                {
                                    data = accounting.unformat($(this).html());
                                }
                                counter += 1;
                            });
                            // data now equals amount

                            //get id of the transaction from the tr by setting the tr class to equal the id
                            var str = $(event.target).closest('tr').attr('id');
                            var spl = str.split("_");
                            if(spl[0] == "bank")
                            {
                                console.log(spl[1]);
                                edit_bank(spl[1],data,spl[2]);
                            }
                            else
                            {
                                if(spl[0] == "cash")
                                {
                                    console.log(spl[1]);
                                    edit_cash(spl[1],data,spl[2]);
                                }
                            }
                        });
                    }
                }
            );

            $("#datemask").inputmask("yyyy-mm-dd", {"placeholder": "yyyy-mm-dd"});

            //iCheck for checkbox and radio inputs
        //Flat red color scheme for iCheck
        accounting.settings = {
            currency: {

                format: "%v", // controls output: %s = symbol, %v = value/number (can be object: see below)
                decimal : ".",  // decimal point separator
                thousand: ",",  // thousands separator
                precision : 2   // decimal places
            },
            number: {
                precision : 2,  // default precision on numbers is 0
                thousand: ",",
                decimal : "."
            }
        }
        $('input[type="checkbox"].flat-red, input[type="radio"].flat-red').iCheck({
            checkboxClass: 'icheckbox_flat-red',
            radioClass: 'iradio_flat-red'
        });
        $('input[type="checkbox"].check_cash_b_c').iCheck({
            checkboxClass: 'icheckbox_flat-red',
            radioClass: 'iradio_flat-red'
        });
       $('input[type="checkbox"].check_cash_b_d').iCheck({
            checkboxClass: 'icheckbox_flat-red',
            radioClass: 'iradio_flat-red'
        });
            $('input[type="checkbox"].check_bank_s_d').iCheck({
            checkboxClass: 'icheckbox_flat-red',
            radioClass: 'iradio_flat-red'
        });
           $('input[type="checkbox"].check_bank_s_c').iCheck({
            checkboxClass: 'icheckbox_flat-red',
            radioClass: 'iradio_flat-red'
        });
                $('input.check_cash_b_c').on('ifChecked ifUnchecked', function(event) {
                    if (event.type == 'ifChecked') {
                        $('input.cash_b_c').iCheck('check');
                    } else {
                        $('input.cash_b_c').iCheck('uncheck');
                    }
                });
                $('input.cash_b_c').on('ifUnchecked', function(event) {
                    $('input.check_cash_b_c').iCheck('uncheck');
                });
               $('input.check_cash_b_d').on('ifChecked ifUnchecked', function(event) {
                    if (event.type == 'ifChecked') {
                        $('input.cash_b_d').iCheck('check');
                    } else {
                        $('input.cash_b_d').iCheck('uncheck');
                    }
                });
                $('input.cash_b_c').on('ifUnchecked', function(event) {
                    $('input.check_cash_b_d').iCheck('uncheck');
                });

               $('input.check_bank_s_d').on('ifChecked ifUnchecked', function(event) {
                    if (event.type == 'ifChecked') {
                        $('input.bank_s_d').iCheck('check');
                    } else {
                        $('input.bank_s_d').iCheck('uncheck');
                    }
                });
                $('input.bank_s_d').on('ifUnchecked', function(event) {
                    $('input.check_bank_s_d').iCheck('uncheck');
                });


               $('input.check_bank_s_c').on('ifChecked ifUnchecked', function(event) {
                    if (event.type == 'ifChecked') {
                        $('input.bank_s_c').iCheck('check');
                    } else {
                        $('input.bank_s_c').iCheck('uncheck');
                    }
                });
                $('input.bank_s_c').on('ifUnchecked', function(event) {
                    $('input.check_bank_s_c').iCheck('uncheck');
                });


        $('input.flat-red').on('ifChecked ifUnchecked', function(event){
            var data = 0;
            var counter = 0;
            $(event.target).closest('td').siblings("td").each(function()
            {
                if(counter == 3)
                {
                    data = accounting.unformat($(this).html());
                }
                counter += 1;
            });
            // data now equals amount

            //get id of the transaction from the tr by setting the tr class to equal the id
            var str = $(event.target).closest('tr').attr('id');
            var spl = str.split("_");
            if(spl[0] == "bank")
            {
                console.log(spl[1]);
                edit_bank(spl[1],data,spl[2]);
            }
            else
            {
                if(spl[0] == "cash")
                {
                    console.log(spl[1]);
                    edit_cash(spl[1],data,spl[2]);
                }
            }
        });
        //get diff on lane one
        var diff_one = "<?php echo $lane_one_diff; ?>";
        //get diff on lane 2
        var diff_two = "<?php echo $lane_two_diff; ?>";


                //total cashbook

            // var cash_total =  parseFloat("50000<?php //echo $cashbook_statement_total; ?>");
            var cash_total =  accounting.unformat($("#c_total").html());
            var cash_opening = accounting.unformat("<?php echo $recon_data['cashbook_closing_balance']; ?>");
            var bank_opening = accounting.unformat("<?php echo $recon_data['bank_closing_balance']; ?>");

            //total bank statement

            var bank_total =  accounting.unformat($("#b_total").html());
            var bsub_credit = accounting.unformat($("#sub_bcredit").html());
            var bsub_debit = accounting.unformat($("#sub_bdebit").html());
            var csub_credit = accounting.unformat($("#sub_ccredit").html());
            var csub_debit = accounting.unformat($("#sub_cdebit").html());
            var transaction_ids = new Array();
        function to_save()
        {
            //send the ids in the transactions id and check them as planned
            $("#save_modal").modal("show");
        }

        function save()
        {
            //send the ids in the transactions id and check them as planned
            var bal =  $("#bs_closing_balance").val();
            if(bal != "" && bal != " ")
            {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
                $.post("<?php echo base_url(); ?>index.php/site/save_recon",
                    {ids : transaction_ids,id_recon :"<?php echo $recon_data['id']; ?>", closing_balance : $("#bs_closing_balance").val()  },
                    function(e){
                        e = JSON.parse(e);
                        if(e.status == "success")
                        {
                            $(".ajax_message").html('');
                            $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, reconciliation saved successfully </p></div>').show().addClass('ajax_success');
                            location.reload();
                            $(".ajax_message").html('');

                        }
                        else
                        {

                            $(".ajax_message").html('<br/><div class="error "><p>' + e.error + "</p></div><br/>");

                        }

                    });

            }

            else

            {
                $(".ajax_message").html('<br/><div class="error "><p>Please Enter Your Bank Statement Closing Balance</p></div><br/>');

            }

        }


        function close_recon()
        {

            bootbox.confirm("Are you sure you want to close this reconciliation ?",function(reply){
                if(reply)
                {
                    $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
                    $.post("<?php echo base_url(); ?>index.php/site/close_recon",
                        {ids : transaction_ids, id_recon :"<?php echo $recon_data['id']; ?>"  },
                        function(e){
                            e = JSON.parse(e);
                            if(e.status == "success")
                            {
                                $(".ajax_message").html('');
                                $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, reconciliation closed successfully </p></div>').show().addClass('ajax_success');
                                window.location = "<?php echo base_url() ?>reconciliations/<?php echo $recon_data['id_account'] ?>";
                                $(".ajax_message").html('');

                            }
                            else
                            {

                                $(".ajax_message").html('<br/><div class="error "><p>' + e.error + "</p></div><br/>");

                            }

                        });

                    }
                else
                {

                }

            });



        }

        function edit_bank(id, amount, tp)
        {

//            amount = amount;
            id = parseInt(id);
            if(transaction_ids.indexOf(id) == -1)
            {
                // id not in array add it and subtract amount
                transaction_ids[transaction_ids.length] = id;
                if(tp == 'credit')
                {
                    bsub_credit -= amount;
                }
                else
                {
                    if(tp == "debit")
                        bsub_debit -= amount;
                }
            }
            else
            {
                //id in array take it off and add amount
                transaction_ids.splice(transaction_ids.indexOf(id), 1);
                if(tp == 'credit')
                {
                   bsub_credit += amount;
                }
                else
                {
                    if(tp == "debit")
                        bsub_debit += amount;

                }
            }

            $("#sub_bcredit").html(accounting.formatMoney(bsub_credit));
            $("#sub_bdebit").html(accounting.formatMoney(bsub_debit));
            adjust_balances('bank',tp,amount);
        }

        function edit_cash(id, amount, tp)
        {

            amount = parseFloat(amount);
            id = parseInt(id);
            if(transaction_ids.indexOf(id) == -1)
            {
                // id not in array add it and subtract amount
                transaction_ids[transaction_ids.length] = id;
                if(tp == "credit")
                {
                   csub_credit -= amount;
                }
                else
                {
                    if(tp == "debit")
                    csub_debit -= amount;
                }
            }
            else
            {
                //id in array take it off and add amount
                transaction_ids.splice(transaction_ids.indexOf(id), 1);
                if(tp == 'credit')
                {
                    csub_credit += amount;
                }
                else
                {
                    if(tp == "debit")
                        csub_debit += amount;
                }
            }

            $("#sub_ccredit").html(accounting.formatMoney(csub_credit));
            $("#sub_cdebit").html(accounting.formatMoney(csub_debit));
            adjust_balances('cash',tp,amount);
        }
        var tran_type = 0;
        var tran_from = 0;
        function add_transaction(type,from,string)
        {
            tran_from = from;
            tran_type = type;
            //TODO

            $("#class_to_add").val(string);
            bootbox.confirm("Please Make Sure You Have Saved Your Currently Checked Transactions Before Adding A New One. <br/> Do You Want To Continue ?",function(reply){
                if(reply)
                {
                    $("#add_transaction").modal("show");
                }
                else
                {

                }

            });



        }

        function upload_transaction(type,from)
        {
            tran_from = from;
            tran_type = type;
            $("#transaction_from").val(from);
            $("#transaction_type").val(type);

            $("#upload_transaction").modal("show");

        }
        function transaction()
        {
            $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            $.post("<?php echo base_url(); ?>index.php/site/add_single_transaction",
                {
                    narration : $("#narration").val(),
                    id_account : $("#id_account").val(),
                    id_user : $("#id_user").val(),
                    ref : $("#ref").val(),
                    amount : accounting.unformat($("#amount").val()),
                    date : $(".date").val(),
                    transaction_from : tran_from,
                    transaction_type : tran_type

                },
            function(e)
            {
            e = JSON.parse(e);
                if(e.status == 'success')
                {

                    if(tran_from == 1 && tran_type == 1)
                    {
                        var di =  bdebit_table.fnAddData(
                            [
                                Date.parse($(".date").val()).toString('dd MMM, yyyy'),
                                $("#ref").val(),
                                $("#narration").val(),
                                accounting.formatMoney($("#amount").val()),
                                '<span class="form-group"> <input type="checkbox" class="flat-red  '+$("#class_to_add").val()+'" /> </span>'
                            ]
                        );



                        var row = bdebit_table.fnGetNodes(di);
                        $(row).attr('id', 'bank_'+e.id);
                        bsub_debit += accounting.unformat($("#amount").val());
                        adjust_balances('bank','debit',accounting.unformat($("#amount").val()));

                    }
                    else
                    if(tran_from == 1 && tran_type == 2)
                    {


                        var di = bcredit_table.fnAddData(
                            [
                                Date.parse($(".date").val()).toString('dd MMM, yyyy'),
                                $("#ref").val(),
                                $("#narration").val(),
                                accounting.formatMoney($("#amount").val()),
                                '<span class="form-group"> <input type="checkbox" class="flat-red" /> </span>'
                            ]
                        );

                        var row = bcredit_table.fnGetNodes(di);
                        $(row).attr('id', 'bank_'+e.id);
                        bsub_credit += accounting.unformat($("#amount").val());
                        adjust_balances('bank','credit',accounting.unformat($("#amount").val()));
                    }
                    else
                    if(tran_from == 2 && tran_type == 1)
                    {
                        var di = cdebit_table.fnAddData(
                            [
                                Date.parse($(".date").val()).toString('dd MMM, yyyy'),
                                $("#ref").val(),
                                $("#narration").val(),
                                accounting.formatMoney($("#amount").val()),
                                '<span class="form-group"> <input type="checkbox" class="flat-red" /> </span>'
                            ]
                        );

                        var row = cdebit_table.fnGetNodes(di);
                        $(row).attr('id', 'cash_'+e.id);
                        csub_debit += accounting.unformat($("#amount").val());

                        adjust_balances('cash','debit',accounting.unformat($("#amount").val()));

                    }
                    else
                    if(tran_from == 2 && tran_type == 2)
                    {


                        var di =  ccredit_table.fnAddData(
                            [
                                Date.parse($(".date").val()).toString('dd MMM, yyyy'),
                                $("#ref").val(),
                                $("#narration").val(),
                                accounting.formatMoney($("#amount").val()),
                                '<span class="form-group"> <input type="checkbox" class="flat-red" /> </span>'
                            ]
                        );
                        csub_credit += accounting.unformat($("#amount").val());
                        adjust_balances('cash','credit',accounting.unformat($("#amount").val()));

                        var row = ccredit_table.fnGetNodes(di);
                        $(row).attr('id', 'cash_'+e.id);



                    }

                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, transaction added successfully </p></div>').show().addClass('ajax_success');
                    $('input[type="checkbox"].flat-red, input[type="radio"].flat-red').iCheck({
                        checkboxClass: 'icheckbox_flat-green',
                        radioClass: 'iradio_flat-green'
                    });

                    $('input').on('ifClicked', function(event){
                        var data = 0;
                        var counter = 0;
                        $(event.target).closest('td').siblings("td").each(function()
                        {
                            if(counter == 3)
                            {
                                data = accounting.unformat($(this).html());
                            }
                            counter += 1;
                        });
                        // data now equals amount

                        //get id of the transaction from the tr by setting the tr class to equal the id
                        var str = $(event.target).closest('tr').attr('id');
                        var spl = str.split("_");
                        if(spl[0] == "bank")
                        {
                            edit_bank(spl[1],data);
                        }
                        else
                        {
                            if(spl[0] == "cash")
                            {
                                edit_cash(spl[1],data);
                            }
                        }
                    });
                    $('input.checkall').iCheck('disable');
                    // Increase the total
                    $("#sub_bcredit").html(accounting.formatMoney(bsub_credit));
                    $("#sub_bdebit").html(accounting.formatMoney(bsub_debit));
                    $("#sub_ccredit").html(accounting.formatMoney(csub_credit));
                    $("#sub_cdebit").html(accounting.formatMoney(csub_debit));

                    $("#add_transaction").modal("hide");
                    $(".ajax_message").html('');
                    location.reload();

                }
                else
                {
                    $(".ajax_message").html('<br/><div class="error "><p>' + e.error + "</p></div><br/>");

                }
            });
        }

            function undo_save(){
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
                $.post('<?php echo base_url() ?>index.php/site/undo_save',{},function(e){
                    e = JSON.parse(e);
                    if(e.status == 'success'){
                        $(".ajax_message").html('');
                        $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, undo action completed successfully </p></div>').show().addClass('ajax_success');
                        setTimeout(function(e){location.reload();}, 1000);
                    }
                });

            }

        function print_preview()
        {
            var doc = new jsPDF();

// We'll make our own renderer to skip this editor
                    var specialElementHandlers = {
                        '#rentalListCan': function(element, renderer){
                            return true;
                        }
                    };

// All units are in the set measurement for the document
// This can be changed to "pt" (points), "mm" (Default), "cm", "in"
                    doc.fromHTML($('#render_me').get(0), 15, 15, {
                        'width': 170,
                        'elementHandlers': specialElementHandlers
                    });
                    doc.output("dataurlnewwindow");

                }

            function adjust_balances(from,type,amount)
            {
                // get opening balances

                // get subtotals

                // do the calculation
                bank_total =  bank_opening + csub_debit + bsub_debit;
                cash_total = cash_opening + csub_credit + bsub_credit;

                var diff = cash_total - bank_total;

                $("#bank_total").html('Adjusted Bank Statement Balance : '+accounting.formatMoney(bank_total)+' Ghc');
                $("#cashbook_total").html('Adjusted Cash Book Balance : '+accounting.formatMoney(cash_total)+' Ghc');
                if(diff != 0)
                {
                    $("#check").html('<div class="box alert-danger" >Difference :'+ accounting.formatMoney(diff)+' </div>');
                }
                else
                {
                    $("#check").html('<div class="box alert-success" >Difference :'+ accounting.formatMoney(diff)+' </div>');

                }

            }


        </script>

<?php
endif;
?>
<?php
    if($caption == "New Account Reconciliation"):
?>
        <!-- iCheck 1.0.1 -->
        <!-- FastClick -->
        <!-- AdminLTE App -->
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.date.extensions.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.extensions.js" type="text/javascript"></script>

        <script>
            $("#datemask").inputmask("mm/yyyy", {"placeholder": "mm/yyyy"});

        $("#datepicker").datepicker( {
            format: "mm/yyyy"
        });




            $(".new_recon").submit(function(e)
            {

                var options = {
                    target: '.ajax_message',
                    type: "post",
                    url: "<?php echo base_url();?>index.php/site/new_recon",
                    dataType: "json",
                    cache: false,
                    data: $('#new_recon').serialize(),
                    beforeSend: function () {
                        $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
                    },
                    success: function (data) {
                        $('.ajax_message').empty();
                        if (data.status == 'success') {
                            $(".ajax_message").html('');
                            $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, reconciliation added successfully </p></div>').show().addClass('ajax_success');
                            console.log(data);
                            window.location = "<?php echo base_url();?>index.php/site/accounts";
                        } else if (data.status == 'error') {
                            console.log(data);
                            $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                        }
                    },
                    error: function () {
                        $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
                    }

                };

                e.preventDefault();
                $('.new_recon').ajaxSubmit(options);

            });

        </script>

<?php
endif;
?>
<?php
    if($caption == "Setup Balance"):
?>
        <!-- iCheck 1.0.1 -->
        <!-- FastClick -->
        <!-- AdminLTE App -->
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.date.extensions.js" type="text/javascript"></script>
        <script src="<?php echo base_url(); ?>extras/plugins/input-mask/jquery.inputmask.extensions.js" type="text/javascript"></script>

      <script>
            $("#datemask").inputmask("mm/yyyy", {"placeholder": "mm/yyyy"});



            $(".setup_balance").submit(function(e)
            {

                var options = {
                    target: '.ajax_message',
                    type: "post",
                    url: "<?php echo base_url();?>index.php/site/setup_balance",
                    dataType: "json",
                    cache: false,
                    data: $('#setup_balance').serialize(),
                    beforeSend: function () {
                        $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
                    },
                    success: function (data) {
                        $('.ajax_message').empty();
                        if (data.status == 'success') {
                            $(".ajax_message").html('');
                            $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, closing balances saved successfully </p></div>').show().addClass('ajax_success');
                            console.log(data);
                            window.location = "<?php echo base_url();?>set_up_transactions/<?php echo $account['id']; ?>";
                        } else if (data.status == 'error') {
                            console.log(data);
                            $(".ajax_message").html('<br/><div class="error "><p>' + data.error + "</p></div><br/>");
                        }
                    },
                    error: function () {
                        $(".ajax_message").html('<div class="error"><p><i class="fa fa-exclamation-circle"></i> Session expired,please make sure you have a network connection and try again</p></div>');
                    }

                };

                e.preventDefault();
                $('.setup_balance').ajaxSubmit(options);

            });

        </script>

<?php
endif;
?>
<script src="<?php echo base_url() ?>extras/js/bootbox.min.js" type="text/javascript"></script>
<script>

    function restore(id)
    {
        bootbox.confirm("Are you sure you want to restore to previously closed reconciliation  <br> This action cannot be reversed and will delete currently opened reconciliation Continue ?",function(reply) {
                if (reply) {
                    $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
                    $.post('<?php echo base_url() ?>index.php/site/restore', {id: id}, function (e) {
                        e = JSON.parse(e);
                        if (e.status == 'success') {
                            $(".ajax_message").html('');
                            $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Account restored </p></div>').show().addClass('ajax_success');
                            location.reload();
                            $(".ajax_message").html('');

                        } else if (e.status == 'error') {
                            console.log(e);
                            $(".ajax_message").html('<br/><div class="error "><p>' + e.error + "</p></div><br/>");
                        }
                    });
                }
            }
            );

    }

</script>

  </body>
</html>