<?php
/**
 * Created by PhpStorm.
 * User: root
 * Date: 4/23/15
 * Time: 2:17 PM
 */
?>
<div class="row">
    <div class="col-xs-12">
        <div class="box">
            <div class="box-header">

            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example1" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Name</th>
                        <th>Action</th>
                        <th>Response</th>
                        <th>Time</th>
<!--                        <th>Actions</th>-->
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    foreach($logs as $log):
                        ?>
                        <tr>
                            <td><?php echo $log['name']; ?></td>
                            <td><?php echo $log['action']; ?></td>
                            <td><?php echo $log['response']; ?></td>
                            <td> <?php echo date('d M, Y @ H:i:s a',$log['time']); ?></td>
<!--                            <td>-->
<!--                                <div class="btn-group">-->
<!--                                    <button type="button" class="btn btn-danger"><i class="fa fa-trash"></i>Delete</button>-->
<!--                                </div>-->
<!--                            </td>-->
                        </tr>
                    <?php
                    endforeach;
                    ?>

                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Name</th>
                        <th>Action</th>
                        <th>Response</th>
                        <th>Time</th>
                        <!--                        <th>Actions</th>-->
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div><!-- /.row -->