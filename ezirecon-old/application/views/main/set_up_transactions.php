
<!-- =========================================================== -->

<!-- Small boxes (Stat box) -->
<div class="row">
    <div class="col-md-3">
        <div class="box box-success">
            <div class="box-header">
                <h3 class="box-title">Setup In Progress</h3>
            </div>
            <div class="box-body">
                Please Click On An Option Below
            </div><!-- /.box-body -->
            <!-- Loading (remove the following to stop the loading)-->
            <div class="overlay">
                <i class="fa fa-refresh fa-spin"></i>
            </div>
            <!-- end loading -->
        </div><!-- /.box -->
    </div><!-- /.col -->

</div><!-- /.row -->
<!-- Small boxes (Stat box) -->
<div class="row">
    <div class="col-lg-3 col-xs-6">
        <!-- small box -->
        <div class="small-box bg-green-active">
            <div class="inner">
                <p>Add Single Transaction</p>
            </div>
            <div class="icon">
                <i class="ion ion-pie-graph"></i>
            </div>
            <a href="<?php echo  base_url(); ?>set_single_transaction/<?php echo $account['id']; ?>" class="small-box-footer">
                Click Here <i class="fa fa-arrow-circle-right"></i>
            </a>
        </div>
    </div><!-- ./col -->
    <div class="col-lg-3 col-xs-6">
        <!-- small box -->
        <div class="small-box bg-green-active">
            <div class="inner">
                <p>Upload Excel Sheet</p>
            </div>
            <div class="icon">
                <i class="ion ion-pie-graph"></i>
            </div>
            <a href="<?php echo  base_url(); ?>set_multiple_transaction/<?php echo $account['id']; ?>" class="small-box-footer">
                Click Here <i class="fa fa-arrow-circle-right"></i>
            </a>
        </div>
    </div><!-- ./col -->
    <div class="col-lg-3 col-xs-6">
        <!-- small box -->
        <div class="small-box bg-red">
            <div class="inner">
                <p>Save And Exit</p>
            </div>
            <div class="icon">
                <i class="ion ion-pie-graph"></i>
            </div>
            <a href="<?php echo  base_url(); ?>accounts" class="small-box-footer">
                Click Here <i class="fa fa-arrow-circle-right"></i>
            </a>
        </div>
    </div><!-- ./col -->
</div><!-- /.row -->

<!-- =========================================================== -->