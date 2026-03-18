<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 2:29 PM
 */
?>
<div class="row">
    <div class="col-xs-12">
        <div class="box">

            <div class="box-header">
                <?php
                if($can_create_new):
                ?>
                    <h3 class="box-title"><a href="<?php echo base_url(); ?>new_reconciliation/<?php echo $this->uri->segment(2); ?>"><button class="btn btn-block btn-primary btn-sm">New Reconciliation </button></a></h3>
                <?php
                endif;
                if(sizeof($reconciliations) > 1):
                ?>
                    <h3 class="box-title"><a href="#" onclick="restore(<?php echo $this->uri->segment(2); ?>);"><button class="btn btn-block btn-primary btn-sm">Restore To Previous Reconciliation </button></a></h3>
                <?php
                endif;
                ?>
            </div><!-- /.box-header -->

            <div class="box-body">
                <div class="ajax_message" id="ajax_message">

                </div>
                <table id="example1" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Month</th>
                        <th>Cash Book Closing Balance</th>
                        <th>Bank Statement Closing Balance</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($reconciliations as $recon):
                        ?>
                        <tr>
                            <td><?php echo ($recon['month']); ?></td>
                            <td><?php echo number_format($recon['cashbook_closing_balance'],2,'.',','); ?></td>
                            <td> <?php echo number_format($recon['bank_closing_balance'],2,'.',','); ?></td>
                            <td>
                                <div class="btn-group">
                                    <?php
                                        if($recon['opened'] == 1):
                                    ?>
                                    <a type="button" class="btn btn-info" href="<?php echo base_url(); ?>open_reconciliation/<?php echo $recon['id']; ?>">Edit </a><br/><br/>
                                            <a type="button" class="btn btn-success" href="<?php echo base_url(); ?>upload_excel/<?php echo $this->uri->segment(2); ?>">Upload Excel File</a>

                                        <?php
                                        else:
                                            ?>
                                            <a type="button" class="btn btn-info" href="<?php echo base_url(); ?>view_reconciliation/<?php echo $recon['id']; ?>">View</a>

                                        <?php
                                            endif;
                                    ?>
                                </div>
                            </td>
                        </tr>
                    <?php
                    endforeach;
                    ?>

                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Month</th>
                        <th>Cash Book Closing Balance</th>
                        <th>Bank Statement Closing Balance</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div><!-- /.row -->