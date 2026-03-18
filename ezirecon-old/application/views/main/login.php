<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 3:48 PM
 */
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome Please Login</title>
    <meta content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' name='viewport'>
    <!-- Bootstrap 3.3.2 -->
    <link href="<?php echo base_url() ?>extras/bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <!-- Font Awesome Icons -->
    <link href="https://maxcdn.bootstrapcdn.com/font-awesome/4.3.0/css/font-awesome.min.css" rel="stylesheet" type="text/css" />
    <!-- Theme style -->
    <link href="<?php echo base_url() ?>extras/dist/css/AdminLTE.min.css" rel="stylesheet" type="text/css" />
    <!-- iCheck -->
    <link href="<?php echo base_url() ?>extras/plugins/iCheck/square/blue.css" rel="stylesheet" type="text/css" />
    <link href="<?php echo base_url() ?>extras/css/mess-style.css" rel="stylesheet" type="text/css" />

    <!-- HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
    <script src="https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
    <script src="https://oss.maxcdn.com/libs/respond.js/1.3.0/respond.min.js"></script>
    <![endif]-->
</head>
<body class="login-page">
<div class="login-box">
    <div class="login-logo">
        <img src="<?php echo base_url() ?>/extras/dist/img/ezirecon.png" class="user-image img-circle" width="25%">
        <a href="<?php echo base_url(); ?>"><b>Ezi</b>Recon</a>
    </div><!-- /.login-logo -->
    <div class="login-box-body">
        <div class="ajax_message" id="ajax_message">

        </div>
        <p class="login-box-msg">Sign in to start your session</p>
        <form action="#" method="post" id="login" class="login">
            <div class="form-group has-feedback">
                <input type="text" class="form-control" placeholder="username" name="username"/>
                <span class="glyphicon glyphicon-user form-control-feedback"></span>
            </div>
            <div class="form-group has-feedback">
                <input type="password" class="form-control" placeholder="Password" name="password"/>
                <span class="glyphicon glyphicon-lock form-control-feedback"></span>
            </div>
            <div class="row">
                <div class="col-xs-6">
                    <button type="submit" class="btn btn-primary btn-block btn-flat">Sign In</button>
                </div><!-- /.col -->
            </div>
        </form>

    </div><!-- /.login-box-body -->
</div><!-- /.login-box -->

<!-- jQuery 2.1.3 -->
<script src="<?php echo base_url() ?>extras/plugins/jQuery/jQuery-2.1.3.min.js"></script>
<!-- Bootstrap 3.3.2 JS -->
<script src="<?php echo base_url() ?>extras/bootstrap/js/bootstrap.min.js" type="text/javascript"></script>
<!-- iCheck -->
<script src="<?php echo base_url() ?>extras/plugins/iCheck/icheck.min.js" type="text/javascript"></script>

<script src="<?php echo base_url() ?>extras/dist/js/jquery-form.js" type="text/javascript"></script>
<script src="<?php echo base_url() ?>extras/dist/js/form_process.js" type="text/javascript"></script>
<script src="<?php echo base_url() ?>extras/dist/js/bootstrapValidator.js" type="text/javascript"></script>



<script>
    $(function () {
        $('input').iCheck({
            checkboxClass: 'icheckbox_square-blue',
            radioClass: 'iradio_square-blue',
            increaseArea: '20%' // optional
        });
    });
</script>



<script>
    $(".login").submit(function(e)
    {

        var options = {
            target: '.ajax_message',
            type: "post",
            url: "<?php echo base_url();?>index.php/users/login_user",
            dataType: "json",
            cache: false,
            data: $('#login').serialize(),
            beforeSend: function () {
                $('.ajax_message').html('<div class="processor"><img style="height:20px; width:20px;" src="<?php echo base_url();?>assets/images/loading.gif" alt="loading gif">  <span>Please wait while we process request!</span></div>');
            },
            success: function (data) {
                $('.ajax_message').empty();
                if (data.status == 'success') {
                    $(".ajax_message").html('');
                    $(".ajax_message").html('<div class="success"><p><i class="fa fa-check-circle"></i>&nbsp;&nbsp;Thank you, you have been logged in successfully </p></div>').show().addClass('ajax_success');

                    console.log(data);
                    window.location = "<?php echo base_url();?>site/home";
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
        $('.login').ajaxSubmit(options);

    });

</script>
</body>
</html>