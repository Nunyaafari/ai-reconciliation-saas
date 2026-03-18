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
                <?php
                    if($user_sess['user_role'] != 0):
                ?>
                <h3 class="box-title"><a href="<?php echo base_url(); ?>new_system_admin"><button class="btn btn-block btn-primary btn-sm">Add System Administrator</button></a></h3>
                <?php
                else:
                    if($num_accounts_left > 0)
                    {

                        ?>

                        <h3 class="box-title"><a href="<?php echo base_url(); ?>new_user">
                                <button class="btn btn-block btn-primary btn-sm">Add User</button>
                            </a></h3>
                    <?php
                    }
                endif;
                ?>
            </div><!-- /.box-header -->
            <div class="box-body">
                <table id="example1" class="table table-bordered table-striped">
                    <thead>
                    <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Number of accounts</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                        foreach($users as $user):
                    ?>
                    <tr>
                        <td><?php echo $user['fullname']; ?></td>
                        <td><?php echo $user['company']; ?></td>
                        <td><?php echo $user['num_accounts']; ?></td>
                        <td> <?php echo date('d-m-Y',strtotime($user['last_logged_in'])); ?></td>
                        <td>
                            <div class="btn-group">
                                <button type="button" class="btn btn-info">Action</button>
                                <button type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown">
                                    <span class="caret"></span>
                                </button>
                                <ul class="dropdown-menu" role="menu">
                                    <li><a href="<?php echo base_url(); ?>edit_user/<?php echo $user['id'] ?>">Edit</a></li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                    <?php
                        endforeach;
                    ?>

                    </tbody>
                    <tfoot>
                    <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Number of accounts</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                    </tfoot>
                </table>
            </div><!-- /.box-body -->
        </div><!-- /.box -->
    </div><!-- /.col -->
</div><!-- /.row -->