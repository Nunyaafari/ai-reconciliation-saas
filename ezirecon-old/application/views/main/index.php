
          <!-- =========================================================== -->

          <!-- Small boxes (Stat box) -->
          <div class="row">
            <div class="col-lg-3 col-xs-6">
              <!-- small box -->
              <div class="small-box bg-aqua">
                <div class="inner">
                  <h3><?php echo $dashboard['accounts']; ?></h3>
                  <p>Accounts</p>
                </div>
                <div class="icon">
                  <i class="fa fa-shopping-cart"></i>
                </div>
              </div>
            </div><!-- ./col -->
              <?php
                if($user_sess['user_role'] == 0 || $user_sess['user_role'] == 1):
              ?>
            <div class="col-lg-3 col-xs-6">
              <!-- small box -->
              <div class="small-box bg-green">
                <div class="inner">
                  <h3><?php echo $dashboard['closed reconciliations']; ?></h3>
                  <p>Closed Reconciliations</p>
                </div>
                <div class="icon">
                  <i class="ion ion-stats-bars"></i>
                </div>
              </div>
            </div><!-- ./col -->
              <?php
                else:
                    ?>
                    <div class="col-lg-3 col-xs-6">
                        <!-- small box -->
                        <div class="small-box bg-green">
                            <div class="inner">
                                <h3><?php echo $dashboard['companies']; ?></h3>
                                <p>Companies</p>
                            </div>
                            <div class="icon">
                                <i class="ion ion-stats-bars"></i>
                            </div>
                        </div>
                    </div><!-- ./col -->
                <?php
              endif;
              if($user_sess['user_role'] != 1):
              ?>
                  <div class="col-lg-3 col-xs-6">
                      <!-- small box -->
                      <div class="small-box bg-yellow">
                          <div class="inner">
                              <h3><?php echo $dashboard['users']; ?></h3>
                              <p>Users</p>
                          </div>
                          <div class="icon">
                              <i class="ion ion-person-add"></i>
                          </div>
                      </div>
                  </div><!-- ./col -->


              <?php
              else:
                  ?>
                  <div class="col-lg-3 col-xs-6">
                      <!-- small box -->
                      <div class="small-box bg-yellow">
                          <div class="inner">
                              <h3><?php echo $dashboard['opened reconciliations']; ?></h3>
                              <p>Opened Reconciliations</p>
                          </div>
                          <div class="icon">
                              <i class="ion ion-person-add"></i>
                          </div>
                      </div>
                  </div><!-- ./col -->

              <?php
              endif;
              ?>

          </div><!-- /.row -->

          <!-- =========================================================== -->